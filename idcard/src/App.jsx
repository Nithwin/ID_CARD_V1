import React from 'react'
import { Route, Routes } from 'react-router-dom'
import LiveDetection from './pages/LiveDetecxtion'
import Login from './pages/Login'
import SavedImagesPage from './pages/SavedImagesPage' // Import the new page
import './globals.css'
const App = () => {
  return (
    <Routes>
      <Route path='/detect' element={<LiveDetection/>} />
      <Route path='/' element={<Login/>} />
      <Route path='/saved-images' element={<SavedImagesPage/>} /> {/* Add route for saved images */}
    </Routes>
  )
}

export default App