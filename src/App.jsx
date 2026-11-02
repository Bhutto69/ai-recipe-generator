import { useState } from 'react'
import './App.css'

const DIETS = ['Any', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free', 'High-protein', 'Low-carb']
const CUISINES = ['Any', 'Pakistani', 'Indian', 'Italian', 'Chinese', 'Mexican', 'Mediterranean', 'American']
const QUICK = ['chicken', 'eggs', 'rice', 'potatoes', 'onion', 'tomatoes', 'pasta', 'spinach', 'yogurt', 'lentils']

export default function App() {
  const [ingredients, setIngredients] = useState('')
  const [diet, setDiet] = useState('Any')
  const [cuisine, setCuisine] = useState('Any')
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addQuick = (item) => {
    const list = ingredients.split(',').map((s) => s.trim()).filter(Boolean)
    if (!list.includes(item)) setIngredients([...list, item].join(', '))
  }

  const generate = async (e) => {
    e.preventDefault()
    if (!ingredients.trim()) { setError('Add at least one ingredient.'); return }
    setLoading(true); setError(''); setRecipe(null)
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          diet: diet === 'Any' ? '' : diet,
          cuisine: cuisine === 'Any' ? '' : cuisine,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRecipe(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <span className="logo">🍳</span>
        <h1>AI Recipe Generator</h1>
        <p>Tell me what's in your kitchen. I'll tell you what to cook.</p>
      </header>

      <form className="card form" onSubmit={generate}>
        <label htmlFor="ingredients">Your ingredients</label>
        <textarea
          id="ingredients"
          rows={3}
          maxLength={500}
          placeholder="e.g. chicken, rice, onion, yogurt"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
        />
        <div className="chips">
          {QUICK.map((item) => (
            <button type="button" key={item} className="chip" onClick={() => addQuick(item)}>+ {item}</button>
          ))}
        </div>

        <div className="row">
          <div>
            <label htmlFor="diet">Diet</label>
            <select id="diet" value={diet} onChange={(e) => setDiet(e.target.value)}>
              {DIETS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cuisine">Cuisine</label>
            <select id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
              {CUISINES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <button className="primary" disabled={loading}>
          {loading ? 'Cooking up a recipe…' : 'Generate recipe'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {loading && <div className="card skeleton" aria-label="Loading recipe" />}

      {recipe && (
        <article className="card recipe">
          <h2>{recipe.title}</h2>
          <p className="desc">{recipe.description}</p>
          <div className="meta">
            {recipe.time && <span>⏱ {recipe.time}</span>}
            {recipe.servings && <span>🍽 Serves {recipe.servings}</span>}
          </div>

          <div className="cols">
            <section>
              <h3>Ingredients</h3>
              <ul className="ingredients">
                {recipe.ingredients?.map((item, i) => (
                  <li key={i}><label><input type="checkbox" /> {item}</label></li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Steps</h3>
              <ol className="steps">
                {recipe.steps?.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </section>
          </div>

          {recipe.tip && <p className="tip">💡 {recipe.tip}</p>}
        </article>
      )}

      <footer>Built with React, Vite and Node · AI by Together AI</footer>
    </div>
  )
}
