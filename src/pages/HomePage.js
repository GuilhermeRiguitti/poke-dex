import { Button, HomeContainer, CardContainer, NavBar, ButtonPage, Logo, PokeDex, DivPagination } from "../components/styled-components/StyledHomeComponent";
import CardComponent from "../components/CardComponent";
import { URL_BASE } from "../constants/URL_BASE";
import { useRequestData } from "../Hooks/useRequestData";
import { goToAboutPage } from "../routes/coordinator";
import { useNavigate } from "react-router-dom";
import { React, useState, useEffect} from "react";


export default function HomePage() { 
  const [contador, setContador] = useState (0)
  const [resultado, setResultado] = useState([])
  const [pokemons, id, name, data, sprites, moves, types, isLoading, error] = useRequestData(`${URL_BASE}?offset=${contador}&limit=20`);
  const navigate = useNavigate()
   
  

  const mudarPagina = (offset) => {
    setContador(offset)
  }
  
  
  
  const pokemonsPokeDex = JSON.parse(localStorage.getItem('lista-pokemons') || '[]');
  var todosPokemons = pokemons;
  var pokedexPokemons = pokemonsPokeDex;
  //const isSamePokemon = (arrayA, arrayB) => arrayA.nome === arrayB.name;
  useEffect(() =>{
    const removerPokemons = () => {
      const pokemonsRemovidos = todosPokemons.filter(({name: id1 }) => 
        !pokedexPokemons.some(({ nome: id2}) => 
          id2 === id1,
          
      ))
      setResultado(pokemonsRemovidos)
    }
     removerPokemons()
  }, [resultado])
    
    
 
    const pokemonsList = resultado && resultado.map((pokemon, index) => {
    return <>
        <CardComponent
          nomePokemon={pokemon.name.toUpperCase()}
          urlPokemon={pokemon.url}
        />
        </>
  })

  return (
    <HomeContainer>
      <NavBar>
        <Button onClick={() => goToAboutPage(navigate, 'pokedexpage') }><PokeDex src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png" /></Button>
        <Logo src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png" />
      </NavBar>
      <CardContainer>
        {isLoading && <p>Carregando ...</p>}
        {!isLoading && error &&<p>Ocorreu um erro</p>}
        {!isLoading && pokemons && pokemons.length > 0 && pokemonsList}
        {!isLoading && pokemons && pokemons.length === 0 && (<p>Nao há nenhum Pokemon</p>)}
      </CardContainer>
      <DivPagination>
        <ButtonPage value={contador} onClick={() => mudarPagina(0)}>1</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(20)}>2</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(40)}>3</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(60)}>4</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(80)}>5</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(100)}>6</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(120)}>7</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(140)}>8</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(160)}>9</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(180)}>10</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(200)}>11</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(220)}>12</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(240)}>13</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(260)}>14</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(280)}>15</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(300)}>16</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(320)}>17</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(340)}>18</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(360)}>19</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(380)}>20</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(400)}>21</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(420)}>22</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(440)}>23</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(460)}>24</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(480)}>25</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(500)}>26</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(520)}>27</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(540)}>28</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(560)}>29</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(580)}>30</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(600)}>31</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(620)}>32</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(640)}>33</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(660)}>34</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(680)}>36</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(700)}>37</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(720)}>38</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(740)}>39</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(760)}>40</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(780)}>41</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(800)}>42</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(820)}>43</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(840)}>44</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(860)}>45</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(880)}>46</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(900)}>47</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(920)}>48</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(940)}>49</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(960)}>50</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(980)}>51</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1000)}>52</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1020)}>53</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1040)}>54</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1060)}>55</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1080)}>56</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1100)}>57</ButtonPage>
        <ButtonPage value={contador} onClick={() => mudarPagina(1120)}>58</ButtonPage>
      </DivPagination>
    </HomeContainer>

  )

}