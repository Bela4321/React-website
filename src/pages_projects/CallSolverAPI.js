function CallSolverAPI() {
    document.getElementById('sudokuInput').addEventListener('submit', function (e) {
        e.preventDefault();
        alert("js called")
        
        // Get the form data as a 2D array
        const formData = new FormData(this);
        const matrix = [];
        for (let i = 0; i < 9; i++) {
            matrix[i] = [];
            for (let j = 0; j < 9; j++) {
                matrix[i][j] = parseFloat(formData.get(`matrix[${i}][${j}]`));
            }
        }

        // You can now pass the matrix to your JavaScript function or perform any other action.
        // For demonstration, we will just display the matrix in the result div.
        document.getElementById('result').innerText = 'Matrix submitted: ' + JSON.stringify(matrix);

        //check validity
        const validity = isValidSudoku(matrix);
        if (validity.length != 0) { 
            alert(validity)
            return;
        }
        //call solver api
        var sudokuString = matrixToString(matrix);
        fetchData(sudokuString);
    });
}


async function fetchData(sudokuString) {
    const url = "http://localhost:8080/sudokuSolve?sudoku="+sudokuString;
    var solvedSudoku;
    try {
        const response = await fetch(url);
    
        if (!response.ok) {
            console.log(response);
          throw new Error('Network response was not ok');
        }
    
        const data = await response.json(); // Parse the response as JSON
    
        // Handle the JSON data
        console.log(data);
        displaySolution(data.content)
    
    } catch (error) {
        // Handle errors
        console.error('There was a problem with the fetch operation:', error);
    }
     
}

function displaySolution(matrix) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const name = `matrix[${i}][${j}]`
            var inputElement = document.querySelector('input[name="'+name+'"]');
            inputElement.value = matrix[i][j]
        }
    }
}

function matrixToString(matrix) {
    var string = "";
    for (let row of matrix) {
        for (let cell of row) {
            if (isNaN(cell)) {
                string += "."
            } else {
                string += cell;
            }
        }
    }
    console.log(string)
    return string;
}


function isValidSudoku(board) {
    // Helper function to check if an array of numbers contains duplicates
    function hasDuplicates(arr) {
        const seen = new Set();
        for (let num of arr) {
            if (!isNaN(num) && seen.has(num)) {
                return true;
            }
            seen.add(num);
        }
        return false;
    }
    // Check rows
    for (let row = 0; row < 9; row++) {
        if (hasDuplicates(board[row])) {
            return "Duplicate in line " + (row+1);
        }
    }
    // Check columns
    for (let col = 0; col < 9; col++) {
        const column = [];
        for (let row = 0; row < 9; row++) {
            column.push(board[row][col]);
        }
        if (hasDuplicates(column)) {
            return "Duplicate in column " + (col+1);
        }
    }

    // Check 3x3 subgrids
    for (let i = 0; i < 9; i += 3) {
        for (let j = 0; j < 9; j += 3) {
            const subgrid = [];
            for (let row = i; row < i + 3; row++) {
                for (let col = j; col < j + 3; col++) {
                    subgrid.push(board[row][col]);
                }
            }
            if (hasDuplicates(subgrid)) {
                return ("Duplicate in box " +i/3)+j/3;
            }
        }
    }

    return "";
}


export default CallSolverAPI;