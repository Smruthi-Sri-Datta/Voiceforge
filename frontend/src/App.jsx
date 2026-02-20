import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Studio from './pages/Studio'

function Home() { return <h1>Home Page</h1> }
function Voices() { return <h1>Voices Page</h1> }
function History() { return <h1>History Page</h1> }

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/voices" element={<Voices />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


