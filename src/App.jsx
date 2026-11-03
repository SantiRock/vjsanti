import { useState } from 'react'
import { Canvas } from './components/Canvas'
import { About } from './components/About'
import { Gallery } from './components/Gallery'
import { Contact } from './components/Contact'
import { Nav } from './components/Nav'
import './App.css'


function App() {
  const [showAbout, setShowAbout] = useState(true)
  const [showGallery, setShowGallery] = useState(false)
  const [showContact, setShowContact] = useState(false)

  return (
    <>
      <Canvas />
      <div className="container">
        <p className='p1'>.-.</p>

        {showAbout && <About />}
        {showGallery && <Gallery />}
        {showContact && <Contact />}
        <Nav
          setAbout={setShowAbout}
          setGallery={setShowGallery}
          setContact={setShowContact}
        />

      </div>
      
    </>
  )
}

export default App
