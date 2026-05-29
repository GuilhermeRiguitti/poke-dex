import { URL_BASE_DETAIL } from "../constants/URL_BASE";
import { useRequestData } from "../Hooks/useRequestData";
import {  NavBar, Button, Logo, PokeDex, StatsTitle, FrontPicture, DetailCard, DetailContainer, DetailpageContainer }  
  from "./styled-components/StyledDetailComponent";
import { goBack, goToHomePage, goToAboutPage } from "../routes/coordinator";
import { useNavigate, useParams } from "react-router-dom";

export default function DetailComponent(props) {
  const navigate = useNavigate()
  const params = useParams()
  const [pokemons, id, name, data, sprites, moves, isLoading, error] = useRequestData(`${URL_BASE_DETAIL}${params.id}`)
  

  const pokemonData = data && data.map((status) => {
    return (
    <p>{status.stat.name.toUpperCase()} : {status.base_stat} </p>     
    )
  })

  const pokemonMoves = moves.map((move, index) => {
    if (index < 4) {
      return (
        <p>{move.move.name.toUpperCase()}</p>
      )
    }
  })


  return (
    <DetailpageContainer>
      <NavBar>
        <Button onClick={() => goToAboutPage(navigate, 'pokedexpage')}><PokeDex src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png" /></Button>
        <Button onClick={() => goToHomePage(navigate)}><Logo src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png" /></Button>
      </NavBar>
      <DetailContainer> 
        <DetailCard>
          <span>
            <FrontPicture src={sprites.front_default}/>
            <FrontPicture src={sprites.back_default}/>
          </span>
          <span>
            <StatsTitle>POKEMON: {name.toUpperCase()}</StatsTitle>
            {pokemonData}
          </span>
          <span>
            <StatsTitle>MOVES</StatsTitle>
            {pokemonMoves}
          </span>
        </DetailCard>
      </DetailContainer>
      <button onClick={() => goToHomePage(navigate)}>Página home</button>
      <button onClick={() => goBack(navigate)}>Voltar</button>
      
    </DetailpageContainer>
)
}