import Navbar from "./components/Navbar";
import Projects from "./pages_general/Projects";
import Contact from "./pages_general/Contact";
import Home from "./pages_general/Home";
import { Route, Routes } from "react-router-dom";

import SudokuSolver from "./pages_projects/SudokuSolver";

function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/projects/sudokuSolver" element={<SudokuSolver />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
