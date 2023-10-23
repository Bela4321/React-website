import React, { useState } from "react";
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import CustomLink from "./CustomLink";
import Dropdown from "./Dropdown";

const Navbar = () => {
  return (
    <nav className="nav">
      <Link to="/" className="site-title">
        Bela Schinke
      </Link>
      <ul>
        <Dropdown />
        <CustomLink to="contact">Contact</CustomLink>
      </ul>
    </nav>
  );
};

export default Navbar;
