
export const Nav = ({setAbout, setGallery, setContact}) => {

    const handleAbout = () => {
        setAbout(true)
        setGallery(false)
        setContact(false)
    }

    const handleGallery = () => {
        setAbout(false)
        setGallery(true)
        setContact(false)
    }

    const handleContact = () => {
        setAbout(false)
        setGallery(false)
        setContact(true)
    }

    return(
        <div className="menu_c">
            <p className="menu" onClick={handleAbout}>About</p>
            <p className="menu" onClick={handleGallery}>Gallery</p>
            <p className="menu" onClick={handleContact}>Contact</p>
            <a className="menu" href="https://av8visual.vercel.app/" target="_blank">AV8</a>
        </div>
    )
}

