// Simple Node.js application for testing debugging
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

function main() {
    console.log('Starting Fibonacci calculation...');
    
    for (let i = 0; i < 10; i++) {
        const result = fibonacci(i);
        console.log(`fibonacci(${i}) = ${result}`);
    }
    
    console.log('Fibonacci calculation complete!');
}

// Add a breakpoint on this line to test debugging
main();