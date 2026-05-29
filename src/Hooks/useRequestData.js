import axios from "axios"
import { useEffect, useState } from "react"

export const useRequestData= (url) => {
    const [pokemons, setPokemons] = useState ([])
    const [id, setId] = useState("")
    const [name, setName] = useState("")
    const [data, setData] = useState([])
    const [sprites, setSprites] = useState({})
    const [moves, setMoves] = useState([])
    const [types, setTypes] = useState([])
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const gets = (url) => {
        setIsLoading(true);
        axios
        .get(url,{
                headers: {
                    "Content-Type": "application/json"
                }
                }
            )
            .then((res) => { 
                setPokemons(res.data.results)
                setId(res.data.id)
                setName(res.data.name)
                setData(res.data.stats);
                setSprites(res.data.sprites)
                setMoves(res.data.moves)
                setTypes(res.data.types)
                setIsLoading(false);
            })
            .catch((error) => {
                setError(error);
                setIsLoading(false);
            });
    };
    
useEffect(() => {
    gets(url);
}, [url])

    return [ pokemons, id, name, data, sprites, moves, types, isLoading, error];
}