import styled from "styled-components"
 
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
    background-color:  transparent;
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

export const CardContainer = styled.div`
    @media screen and (min-width: 320px){
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        justify-items: center;
    }
    @media screen and (min-width: 768px){
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
        justify-items: center;
    }
`

export const HomeContainer = styled.div`
    background-image: url("https://wallpaperaccess.com/full/45664.jpg");
    background-repeat: no-repeat;
    background-size: cover;
    padding-bottom: 50px;
    height: max-content;
`

export const DivPagination = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: center; 
`

export const ButtonPage = styled.button`
    background-color:  #c95b2c95;
    border: 0px;
    margin: 2px;
    border-radius: 3px;
    color: white;
    cursor: pointer;
`