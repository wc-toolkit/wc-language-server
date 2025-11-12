//
// JavaScript Test
//

const count = 5;
/** Count in string format */
const countStr = "5ms";

// This should error: countStr is string, duration expects number
const alert1 = `<sl-animation duration="${countStr}"></sl-animation>`;

// This should be valid: count is number, duration expects number
const alert2 = `<sl-animation - duration="${count}"></sl-animation>`;