import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your authentication logic here
    console.log('Logging in with:', username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-700 to-blue-800">
      <div className="relative w-full max-w-md bg-gray-900 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden">
        {/* Animated Background Bubbles */}
        <div className="absolute inset-0 animate-pulse">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
        </div>

        <div className="relative py-12 px-8 md:px-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            <span className="block">Welcome to</span>
            <span className="block text-blue-400">ID Card Detection System</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-gray-300 text-sm font-bold mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-800 text-white border-gray-700"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-gray-300 text-sm font-bold mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-800 text-white border-gray-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm text-gray-400 hover:text-gray-300">
                <input type="checkbox" className="mr-2 leading-tight text-blue-500 focus:ring-blue-500" />
                <span className="text-sm">Remember me</span>
              </label>
              <a className="inline-block align-baseline font-bold text-sm text-blue-400 hover:text-blue-300" href="#">
                Forgot Password?
              </a>
            </div>
            <div className='flex w-full'>
              <Link
                to={'/detect'}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 text-center"
              >
                Sign In
              </Link>
            </div>
          </form>
          <p className="text-center text-gray-500 text-xs mt-8">
            &copy; {new Date().getFullYear()} ID Card Detection System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;