import styled from "styled-components";
import card from "./images/card.png"

export const NavBar = styled.div`
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    height: max-content;
    width: 100%;  
    align-items: center;
    background-color: transparent ; 
    justify-items: center;
`

export const Button = styled.button`
    padding: 0;
    cursor: pointer;
    background-color: transparent;
    border: 0px;
`

export const Logo = styled.img`
    width: 300px;
    height: 70px;
    padding: 10px;
`

export const PokeDex = styled.img`
    width: 80px;
    height: 80px;
 
`

export const PokeDexCardContainer = styled.div`
    @media screen and (min-width: 320px){
        display: grid;
        grid-template-columns: 1fr 1fr;
        justify-items: center;
    }
    @media screen and (min-width: 768px){
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
        justify-items: center;
    }
`


export const CardPokeDex = styled.div`
  border: 1px solid green;
  width: 164px;
  display: flex;
  height: 230px;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  justify-items: flex-end;
  margin: 50px;
  border-radius: 10px;
  box-shadow: 3px 3px 4px #77361a;
  background-image: url(${card});
  background-color: white;
  background-color: #1BB06E99;
`
export const PokemonPhoto = styled.img`
  width: 100%;
  margin-bottom: -15px;

`
export const BatalhaImg = styled.img`
 width: 30%;
 margin-bottom: -40px;
 margin-right: 220px;
`

export const BatalhaStatus = styled.p`
  font-family: 'Open Sans';
  font-weight: 700;
  margin: 10px;
`
export const BatalhaDiv = styled.div`
  display: flex;
  justify-content: center;
  color: white
  
`
export const TituloBatalha = styled.div`
  display: flex;
  margin-top: 100px;
  font-size: larger;
  font-weight: bolder;
  color: white;
  justify-content: center;
  width: 100%;
`
export const TituloOponente = styled.div`
  display: flex;
  margin-top: 10px;
  font-size: larger;
  font-weight: bolder;
  color: green;
  justify-content: center;
  width: 100%;
`
export const DivStatus = styled.div`
  display: grid;
  grid-template-rows: 1fr 1fr 1fr 1fr 1fr 1fr;
  font-family: 'Open Sans';
  font-weight: 600;
  justify-items: left;
  text-align: left;
  font-size: 8px;
  width: 100%;
  margin: 0px 0px 0px 20px;
`

export const TextoStatus = styled.p`
  margin: 1px;
  margin: 0px 0px 0px 2px;
`

export const DivBotoes = styled.div`
  display: grid;
  grid-template-columns: 2fr 2fr
`

export const BotaoCard = styled.button`
  background-color: transparent;
  padding: 7px;
  border-radius: 15px;
  margin: 7px 5px 7px 5px;
  border: 0px;
  color: green;
  cursor: pointer;
  
`



export const PokeDexContainer = styled.div`
    background-image: url("https://wallpaperaccess.com/full/45664.jpg");
    background-repeat: no-repeat;
    height: max-content;
    background-size: cover;
    padding-bottom: 50px;
`
