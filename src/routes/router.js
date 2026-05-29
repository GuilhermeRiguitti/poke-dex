import AboutPage from "../pages/AboutPage";
import HomePage from "../pages/HomePage"; 
import { ErrorPage } from "../pages/ErrorPage";
import { BrowserRouter, Routes, Route } from "react-router-dom";


export const Router = () => {
    return(
        <BrowserRouter>
            <Routes>
                <Route index element = {<HomePage/>}/>
                <Route path="pokemon/:id" element={<AboutPage/>} />
                <Route path="*" element={<ErrorPage />} />
            </Routes>
        </BrowserRouter>
    )
}