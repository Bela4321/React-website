export default function Contact() {
  return (
    //make div for whole screen, horizontal list
    <div className="contact">
      <h1>Contact</h1>
      <ul className="horizontal-list" id="contactList">
        {contactOption(
          "Email",
          "src\\assets\\email.png ",
          "mailto:bela.schinke@gmail.com"
        )}
        {contactOption(
          "LinkedIn",
          "src\\assets\\linkedin.png",
          "https://www.linkedin.com/in/bela-schinke/"
        )}
        {contactOption(
          "GitHub",
          "src\\assets\\github.png",
          "https://github.com/Bela4321"
        )}
      </ul>
    </div>
  );
}

function contactOption(value: string, icon: string, link: string) {
  return (
    <li>
      <a href={link} target="_blank">
        <img className="contactIcon" src={icon} alt={value} />
      </a>
      <p>{value}</p>
    </li>
  );
}
