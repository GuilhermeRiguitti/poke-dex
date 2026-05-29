import { useEffect, useState } from "react";
import { TextoStatus, DivStatus, DivBotoes, BotaoCard , NavBar, Button, Logo, PokeDex, CardPokeDex, PokemonPhoto, PokeDexContainer, PokeDexCardContainer, BatalhaImg, BatalhaDiv, BatalhaStatus, TituloBatalha, TituloOponente } 
  from "../components/styled-components/StyledPokeDexComponent"
import { goBack, goToHomePage } from "../routes/coordinator";
import { goToAboutPage } from "../routes/coordinator"
import { useNavigate } from "react-router-dom";
import axios from "axios";
import batalha from "../components/styled-components/images/batalha.webp"
export default function PokeDexPage() {
  const navigate = useNavigate() 
  const [pokemons, setPokemons] = useState ([])
  const [listaBatalha1, setListaBatalha1] = useState ([])
  const [listaBatalha2, setListaBatalha2] = useState ([])
  const [oponente1, setOponente1] = useState ([])
  const [oponente2, setOponente2] = useState ([])
  useEffect(() => {
    const pokemon = JSON.parse(localStorage.getItem("lista-pokemons"));
    if (pokemon){
      setPokemons(pokemon)
    }
  }, [pokemons] )
  
  //precisei fazer uma nova requicao na api para buscar os dados para usar na batalha, achei mais facil
  //faze uma nova requicao para isso, que recebe o id como parametro que vem do localStorage
  const pokemonsBatalha = (id) => {
    if(listaBatalha1.length === 0){
      axios.
        get(`https://pokeapi.co/api/v2/pokemon/${id}`,{
          headers: {
            "Content-Type": "application/json"
          }
        })
        .then((res) => {
            var pokemon = res.data.stats;
              setListaBatalha1(pokemon)
          })
      }
      else if(listaBatalha1){
        axios.
          get(`https://pokeapi.co/api/v2/pokemon/${id}`,{
            headers: {
              "Content-Type": "application/json"
            }
          })
          .then((res) => {
              var pokemon = res.data.stats;
                setListaBatalha2(pokemon) 
            })
        }
      }
     
  //minha pokedex ainda nao consegui terminar, nao consegui comprar os dois valores, mas nessa parte do codigo
  // tentei criar dois vetores de objetos para inserir os dados de dois pokemons e no final comparar os dois vetores(falta comparar)
  //uma parte ja funciona, ja consegui receber os status e exibilo, so clika nas espadas cruzadas para realizar o teste 
  const pokemon1 = listaBatalha1 && listaBatalha1.map((status) => {
    return  <BatalhaStatus>{status.stat.name.toUpperCase()} : {status.base_stat} ||</BatalhaStatus>
  })

  const pokemon2 = listaBatalha2 && listaBatalha2.map((status) => {
    return (
      <BatalhaStatus>{status.stat.name.toUpperCase()} : {status.base_stat} ||</BatalhaStatus>
    )
  })
      

  //funcao que atualiza a pokedex quando o botao remover é acionado
  function attPokeDex(nome){
    var listaPokemons = JSON.parse(localStorage.getItem('lista-pokemons') );
    const novaPokeDex = listaPokemons.filter((pokemon) => {
      return pokemon.nome !== nome
    })
    localStorage.setItem("lista-pokemons", JSON.stringify(novaPokeDex));
  }

    

  // mapea o vetor coms os valores do local storage, e retorna os card montados
  const pokemonMap = pokemons.map((pokemon) => {
    return <CardPokeDex>
              <Button onClick={() => pokemonsBatalha(pokemon.id)}><BatalhaImg src="https://cdn-icons-png.flaticon.com/512/1732/1732452.png"/></Button>
              <PokemonPhoto src={pokemon.foto}/>
                <p>{pokemon.nome.toUpperCase()}</p>
                
              <DivBotoes>
                
                <BotaoCard onClick={() => attPokeDex(pokemon.nome)}>Remover</BotaoCard>
                <BotaoCard onClick={() => goToAboutPage(navigate, pokemon.id)}>Detalhes</BotaoCard>
              </DivBotoes>
            </CardPokeDex>
  })

  
  
  return (
    <PokeDexContainer>
      <NavBar>
      <Button onClick={() => goToHomePage(navigate)}><PokeDex src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png" /></Button>
      <Button  onClick={() => goToHomePage(navigate)}><Logo src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png" /></Button>
    </NavBar>
      <PokeDexCardContainer>
        {pokemonMap}
      </PokeDexCardContainer>
    <TituloBatalha>Compare Dois pokemons!</TituloBatalha>
    <TituloOponente>Oponente 1</TituloOponente>
    <BatalhaDiv>
      {pokemon1}
    </BatalhaDiv>
    <TituloOponente>Oponente 2</TituloOponente>
    <BatalhaDiv>
      {pokemon2}
    </BatalhaDiv>
    </PokeDexContainer>
    )
}

