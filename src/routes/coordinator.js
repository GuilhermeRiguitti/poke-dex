
export const goToAboutPage = (navigate, id) => {
    navigate(`/pokemon/${id}`)
}


export const goToHomePage = (navigate) => {
    navigate("/")
}

export const goBack = (navigate) => {
    navigate(-1)
}