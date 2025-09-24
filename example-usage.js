// Example Node.js program for debugging demonstration
console.log("Starting example program...");

function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

function main() {
    const numbers = [5, 8, 10];
    
    for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i];
        console.log(`Calculating fibonacci(${num})...`);
        
        const result = fibonacci(num);
        console.log(`fibonacci(${num}) = ${result}`);
    }
    
    console.log("Program completed!");
}

main();