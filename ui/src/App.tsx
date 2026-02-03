import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Constella</h1>
      <button
        onClick={() => {
          // @ts-ignore
          alert(window.api.ping())
        }}
      >
        Ping backend
      </button>
    </div>
  )
}

export default App
