// Simple helper to generate a JWT for manual endpoint testing
// Usage: node gen-jwt.js permission1,permission2

const jwt = require('jsonwebtoken');

const permsArg = process.argv[2] || '';
const permissions = permsArg.length ? permsArg.split(',') : [];
const secret = process.env.JWT_SECRET || 'your-secret-key';

const token = jwt.sign({ sub: 1, username: 'tester', permissions }, secret);
process.stdout.write(token);


