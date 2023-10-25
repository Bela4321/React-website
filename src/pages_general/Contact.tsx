import EmailImg from "../assets/email.png";
import LinkedInImg from "../assets/linkedin.png";
import GitHubImg from "../assets/github.png";

export default function Contact() {
  return (
    //make div for whole screen, horizontal list
    <div className="contact">
      <h1>Contact</h1>
      <ul className="horizontal-list" id="contactList">
        {contactOption("Email", EmailImg, "mailto:bela.schinke@gmail.com")}
        {contactOption(
          "LinkedIn",
          LinkedInImg,
          "https://www.linkedin.com/in/bela-schinke/"
        )}
        {contactOption("GitHub", GitHubImg, "https://github.com/Bela4321")}
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
