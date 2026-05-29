import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { goBack, goToHomePage } from "../routes/coordinator";
import DetailComponent from "../components/DetailComponent"
import PokeDexPage from "./PokeDexPage";


  const AboutPage = () => {
  const navigate = useNavigate()
  const params = useParams()
 

  return (
    <div>
      
      {params.id === 'pokedexpage' ? <PokeDexPage/> : <DetailComponent/>}
  
    </div>
  );
};

export default AboutPage;