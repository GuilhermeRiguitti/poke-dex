import styled from "styled-components";
import card from "./images/card.png"
import cardMobile from "./images/cardMobile.png"

export const CardContainer = styled.div`
  @media screen and (min-width: 320px){
    border: 2px solid green;
    width: 90px;
    height: 126px;
    display: grid;
    grid-template-rows: 1fr 1fr 1fr 1fr;
    justify-items: center;
    align-items: center;
    margin: 2px;
    border-radius: 10px;
    box-shadow: 2px 2px 3px #77361a;
    background-image: url(${cardMobile});
    background-color: #1BB06E99;
  }
  @media screen and (min-width: 768px){
    border: 2px solid green;
    width: 164px;
    display: grid;
    height: 230px;
    grid-template-rows: 1fr 1fr 1fr 1fr;
    justify-items: center;
    align-items: center;
    margin: 20px;
    border-radius: 10px;
    box-shadow: 3px 3px 4px #77361a;
    background-image: url(${card});
    background-color: #1BB06E99;
  }
`
export const TextoNome = styled.p`
  @media screen and (min-width: 320px){
    font-size: 8px;
    margin-top: 0px;
  }
  @media screen and (min-width: 768px){
    font-size: 12px;
    margin-top: 5px
  }
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
  margin: 16px 0px 0px 20px;
  
`


export const TextoStatus = styled.p`
  @media screen and (min-width: 320px){
    margin: 0px 0px 0px 2px;
    font-size: 5px;
 }
  @media screen and (min-width: 768px){

    margin: 0px 0px 0px 2px;
    font-size: 8px;
}
`
export const DivBotoes = styled.div`
    display: grid;
    grid-template-columns: 2fr 2fr
`

export const BotaoCard = styled.button`
  @media screen and (min-width: 320px){
    background-color: transparent;
    padding: 0px;
    border-radius: 15px;
    margin: 10px 5px 7px 5px;
    border: 0px;
    color: green;
    cursor: pointer;
    font-size: 7px;
  
  }
  @media screen and (min-width: 768px){
    background-color: transparent;
    padding: 7px;
    border-radius: 15px;
    margin: 7px 5px 7px 5px;
    border: 0px;
    color: green;
    cursor: pointer;
    font-size: 13px;
  }
`

export const PokemonPhoto = styled.img`
  @media screen and (min-width: 320px){
    width: 50%;
    margin-top: -15px;
    margin-bottom: -10px;
  }
  @media screen and (min-width: 768px){
    width: 70%;
    margin-top: -25px;
    margin-bottom: -10px;
  }
;
`

