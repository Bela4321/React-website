import React, { useState } from "react";
import CustomLink from "./CustomLink";

const Dropdown = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const handleMouseEnter = () => {
    setShowDropdown(true);
  };
  const handleMouseLeave = () => setShowDropdown(false);
  return (
    <div
      className="dropdown"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CustomLink to="/projects">Projects</CustomLink>
      {showDropdown && (
        <div className={"dropdown" + (showDropdown ? " pos-abs" : "")}>
          <CustomLink to="/projects/SudokuSolver">Sudoku Solver</CustomLink>
          <CustomLink to="/projects/ticTacToe">TicTacToe</CustomLink>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
