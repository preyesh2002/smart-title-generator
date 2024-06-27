import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, setCookie } from '../../../utils/cookies';
import { getClientIp } from 'request-ip';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import OpenAI from 'openai';
import cookie from 'cookie'

const MAX_REQUESTS = 5;
const MAX_TOKENS = 1000;

const openai = new OpenAI();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const checkUsage = (ip: string, cookies: { [key: string]: string }) => {
    let usageData;
    try {
        usageData = JSON.parse(cookies.usageData || '{}');
    } catch (error) {
        usageData = {};
    }

    if (!usageData[ip]) {
        usageData[ip] = 0;
    }

    return usageData[ip];
};

const incrementUsage = (res: NextResponse, ip: string, cookies: { [key: string]: string }) => {
    let usageData;
    try {
        usageData = JSON.parse(cookies.usageData || '{}');
    } catch (error) {
        usageData = {};
    }

    usageData[ip] = (usageData[ip] || 0) + 1;
    // setCookie(res, 'usageData', JSON.stringify(usageData), { maxAge: 30 * 24 * 60 * 60 }); // 30 days
    res.headers.set('Set-Cookie', cookie.serialize('usageData', JSON.stringify(usageData), { path: '/', maxAge: 30 * 24 * 60 * 60 })); // 30 days
};

const generateImageDescription = async (base64Image: string) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    //content: `What’s in this image? ${imageUrl}`
                    content: [
                        { type: 'text', text: "What’s in this image?" },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
        });

        if (response.choices && response.choices[0]) {
            return response.choices[0].message.content.trim();
        }
        throw new Error('Failed to generate image description');
    } catch (error) {

        console.error('Error generating image description:', error);
        throw error;
    }
};

const generateSeoContent = async (description: string, title: string, prompt: string) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [
                {
                    role: 'user',
                    content: `Generate an SEO-friendly product title and description based on the following title and description: 
                      Title: ${title}
                      Description: ${description}`
                }
            ],
            max_tokens: 150,
        });

        if (response.choices && response.choices[0]) {
            return response.choices[0].message.content.trim();
        }
        throw new Error('Failed to generate SEO content');
    } catch (error) {
        console.error('Error generating SEO content:', error);
        throw error;
    }
};

const fetchImageAsBase64 = async (imagePath: string) => {
    try {
        const response = await fetch(imagePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();

        const base64Image = Buffer.from(buffer).toString('base64');

        return base64Image;
    } catch (error) {
        console.error('Error fetching image as base64:', error);
        throw error;
    }
};

export async function POST(req: NextRequest) {
    const cookies = parseCookies(req);
    const ip = getClientIp(req) || '';
    const { email, title, description, prompt, imageUrl } = await req.json();

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const usageCount = checkUsage(ip, cookies);

    if (usageCount >= MAX_REQUESTS) {
        return NextResponse.json({ error: 'Usage limit exceeded. Please sign up on Marukatte app to generate more.' }, { status: 403 });
    }
    let imagePath = '';

    let imageDescription = '';

    if (imageUrl && imageUrl.publicUrl) {
        imagePath = imageUrl.publicUrl;

        const base64Image = await fetchImageAsBase64(imagePath)

        try {
            imageDescription = await generateImageDescription(base64Image);
        } catch (error) {
            return NextResponse.json({ error: 'Failed to generate image description' }, { status: 500 });
        }
    }

    let constructedPrompt = 'Generate an SEO friendly product title and description based on the following information:';

    if (title) {
        constructedPrompt += `\nProduct Title: ${title}`;
    }

    if (description) {
        constructedPrompt += `\nProduct Description: ${description}`;
    }

    if (imageUrl && imageUrl.publicUrl) {
        constructedPrompt += `\nImage URL: ${imageUrl.publicUrl}\nImage Description: ${imageDescription}`;
    }

    if (prompt) {
        constructedPrompt += `\nAdditional Information: ${prompt}`;
    }

    if (!title && !description && !prompt && !imageUrl) {
        constructedPrompt = "It seems like you haven't provided enough information. Please provide details such as the product name, features, benefits, and any other relevant information to generate an effective title and description.";
    } else {
        constructedPrompt += "\nUsing this information, create a compelling and SEO-friendly product title and description.";
    }

    console.log('Constructed Prompt:', constructedPrompt); // Log the constructed prompt

    try {
        console.log('Making request to OpenAI API for text generation...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Use the gpt-4-turbo model
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that generates SEO friendly product titles and descriptions.'
                    },
                    {
                        role: 'user',
                        content: constructedPrompt
                    }
                ],
                max_tokens: MAX_TOKENS
            })
        });

        console.log('Response status from text generation API:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response from text generation API:', errorText);
            throw new Error(`Failed to fetch from OpenAI: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data from text generation API:', data);

        if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
            throw new Error('Unexpected response format from OpenAI API');
        }

        const outputText = data.choices[0].message.content.trim();

        const [outputTitle, outputDescription] = outputText.split('\n\n');

        const res = NextResponse.json({
            outputTitle: outputTitle ? outputTitle.trim() : '',
            outputDescription: outputDescription ? outputDescription.trim() : ''
        });

        incrementUsage(res, ip, cookies);

        // // Delete the image from Supabase
        // const { error: deleteError } = await supabase.storage.from('assets').remove([imageUrl.publicUrl]);
        // if (deleteError) {
        //     console.error(`Failed to delete image from Supabase: ${deleteError.message}`);
        // }

        return res;
    } catch (error) {
        console.error('Error during text generation request:', error);
        return NextResponse.json({ error: 'Failed to generate SEO content' }, { status: 500 });
    } finally {
        // Delete the image from Supabase
        const filePath = imagePath.startsWith('public/') ? imagePath : `public/${imagePath}`;
        const { error: deleteError } = await supabase.storage.from('assets').remove([filePath]);
        if (deleteError) {
            console.error(`Failed to delete image from Supabase: ${deleteError.message}`);
        }
    }
}