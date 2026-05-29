import React from "react";
import { TextoNome, DivStatus, DivBotoes, BotaoCard, CardContainer, PokemonPhoto, TextoStatus} from "./styled-components/StyledCardComponent";
import { useRequestData } from "../Hooks/useRequestData";
import { useNavigate } from "react-router-dom";
import { goToAboutPage } from "../routes/coordinator";

function CardComponent(props) {
    const navigate = useNavigate()
    const [pokemons, id, name, data, sprites, moves, isLoading, error] = useRequestData(props.urlPokemon)
    
    const pokemonData = data && data.map((status) => {
        return (
            <TextoStatus>{status.stat.name.toUpperCase()} : {status.base_stat} </TextoStatus>
        )
    })
 
    function salvarPokemon() {
        var idPokemon = id;
        var nomePokemon = name;
        var fotoPokemon = sprites.front_default;
        var statusPokemon = data;
        var listaPokemons = JSON.parse(localStorage.getItem('lista-pokemons')|| '[]');
        listaPokemons.push({
            id: idPokemon, 
            nome: nomePokemon,
            status: statusPokemon,
            foto: fotoPokemon,
        });
        localStorage.setItem("lista-pokemons", JSON.stringify(listaPokemons));
        console.log('Salva com sucesso!')
        }  
        
    
  
    
    
    
    return (
        <CardContainer>
             <TextoNome>{props.nomePokemon}</TextoNome>
            <PokemonPhoto src={sprites.front_default}/>
            
            <DivStatus>
        
                {pokemonData}
            </DivStatus>
            
            <span>
                <DivBotoes>
                    <BotaoCard onClick={salvarPokemon}>Adicionar</BotaoCard> 
                    <BotaoCard onClick={() => goToAboutPage(navigate, id)}>Detalhes</BotaoCard>
                </DivBotoes>
            </span>
        </CardContainer>  
        
       
      )
    }



export default CardComponent;
