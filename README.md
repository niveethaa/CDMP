# course-project-nacss

This repository was created through GitHub Classroom for the NACSS course project.

## Tech Stack

- Front-end: React
- Back-end: Express
- Database: MongoDB
- Testing: Jest and Cypress

## Project Structure

```txt
course-project-nacss/
  client/    # React front-end
  server/    # Express back-end
  README.md
```

## Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- MongoDB connection string or local MongoDB setup

## Front-end Setup

```bash
cd client
npm install
npm run dev
```

The React app runs at:

```txt
http://localhost:5173
```

## Back-end Setup

```bash
cd server
npm install
npm run dev
```

The Express API runs at:

```txt
http://localhost:5000
```

Health check route:

```txt
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "message": "API is running"
}
```

## Environment Variables

Create a `.env` file inside the `server/` folder:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string_here
```

Do not commit the `.env` file.

## Running Tests

### Back-end Tests

```bash
cd server
npm test
```

### Cypress Tests

Start the React app first:

```bash
cd client
npm run dev
```

Then open Cypress:

```bash
npm run cypress:open
```

Or run Cypress in the terminal:

```bash
npm run cypress:run
```

## Current Status

- React app setup complete
- Express server setup complete
- MongoDB configuration added
- Jest test setup complete
- Cypress test setup complete
