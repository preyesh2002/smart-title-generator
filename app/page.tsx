"use client";

import { useState, ChangeEvent, FormEvent, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface FormData {
  image: File | null;
  title: string;
  description: string;
  prompt: string;
  email: string;
  outputTitle: string;
  outputDescription: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const Home = () => {
  const [formData, setFormData] = useState<FormData>({
    image: null,
    title: '',
    description: '',
    prompt: '',
    email: '',
    outputTitle: '',
    outputDescription: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (files) {
      setFormData(prevState => ({ ...prevState, [name]: files[0] }));
    } else {
      setFormData(prevState => ({ ...prevState, [name]: value }));
    }
  };

  const uploadImage = async (file: File) => {
    const { data, error } = await supabase.storage.from('assets').upload(`public/${file.name}`, file);
    if (error) {
      throw error;
    }
    const publicUrl = supabase.storage.from('assets').getPublicUrl(`public/${file.name}`).data;
    if (!publicUrl) {
      throw new Error('Failed to retrieve public URL for the image');
    }
    return publicUrl;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let imageUrl = '';
      if (formData.image) {
        imageUrl = await uploadImage(formData.image);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          title: formData.title,
          description: formData.description,
          prompt: formData.prompt,
          imageUrl
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while generating the SEO content.');
      }

      const data = await response.json();
      setFormData(prevState => ({
        ...prevState,
        outputTitle: data.outputTitle,
        outputDescription: data.outputDescription
      }));
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      image: null,
      title: '',
      description: '',
      prompt: '',
      email: '',
      outputTitle: '',
      outputDescription: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Generate SEO Content</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="image">Product Image:</label>
            <input className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:shadow-outline" type="file" name="image" onChange={handleInputChange} ref={fileInputRef} />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">Product Title:</label>
            <input className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:shadow-outline" type="text" name="title" value={formData.title} onChange={handleInputChange} />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">Product Description:</label>
            <textarea className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:shadow-outline" name="description" value={formData.description} onChange={handleInputChange}></textarea>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="prompt">Prompt Instruction:</label>
            <input className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:shadow-outline" type="text" name="prompt" value={formData.prompt} onChange={handleInputChange} />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email ID:</label>
            <input className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:shadow-outline" type="email" name="email" value={formData.email} onChange={handleInputChange} required />
          </div>
          <div className="flex items-center justify-between">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit" disabled={loading}>Generate</button>
            <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="button" onClick={handleClear} disabled={loading}>Clear</button>
          </div>
          {loading && <p className="text-center text-blue-500 mt-4">Loading...</p>}
          {error && <p className="text-center text-red-500 mt-4">{error}</p>}
        </form>
        <div className="mt-6">
          <h2 className="text-xl font-bold">Generated Title:</h2>
          <p>{formData.outputTitle}</p>
          <h2 className="text-xl font-bold mt-4">Generated Description:</h2>
          <p>{formData.outputDescription}</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
