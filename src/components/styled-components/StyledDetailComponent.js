import styled from "styled-components";

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


export const DetailpageContainer = styled.div`
    background-image: url("https://wallpaperaccess.com/full/45664.jpg");
    background-repeat: no-repeat;
    background-size: cover;
    padding-bottom: 50px;
    height: 95vh;
`

export const DetailContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  
  
`

export const DetailCard = styled.div`
  align-items: center;
  justify-content: space-around;
  display: grid;
  grid-template-columns: 3fr 3fr 3fr;
  width: 70%;
  color: white;
  justify-content: center;
  margin: 50px;
  border-radius: 9px;
  box-shadow: 3px 3px 4px gray;
  background-color:  rgb(0,50,400, 0.40 );

` 

export const FrontPicture = styled.img`
width: 50%;
margin: 10px;
border: 1px solid gray;
border-radius: 9px;
box-shadow: 2px 2px 3px gray;

`

export const StatsTitle = styled.p`
  font-family: Arial, Helvetica, sans-serif;
  font-size: 16px;
  color: green;
  font-weight: bold;
`

