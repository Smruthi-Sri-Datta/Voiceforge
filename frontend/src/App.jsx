import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Studio from './pages/Studio'

function Home() { return <h1>Home Page</h1> }
function Voices() { return <h1>Voices Page</h1> }
function History() { return <h1>History Page</h1> }

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/voices" element={<Voices />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App


