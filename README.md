# Dynamic Table API

A FastAPI-based web application that provides a dynamic table interface with filtering and pagination capabilities.

## Features

- RESTful API endpoints for data management
- Dynamic table with server-side filtering and pagination
- MySQL database integration
- CORS support for frontend integration
- Static file serving

## Tech Stack

- Backend: FastAPI
- Database: MySQL (using SQLAlchemy ORM)
- Frontend: HTML, JavaScript
- Additional Libraries:
  - PyMySQL for MySQL connection
  - Uvicorn for ASGI server
  - Pydantic for data validation

## Project Structure

```
├── app.py                 # Main FastAPI application
├── src/
│   ├── database/         # Database configuration
│   ├── models/          # SQLAlchemy and Pydantic models
│   ├── routes/         # API route handlers
│   └── static/         # Static files (HTML, JS, CSS)
```

## API Endpoints

### `GET /`
- Serves the main HTML page

### `GET /api/get-table-data`
- Fetches paginated table data
- Query Parameters:
  - `page`: Page number (default: 1)
  - `page_size`: Items per page (default: 50)
  - `filters`: Optional filter string

### `POST /api/populate-data`
- Populates the database with employee data
- Request Body: Array of employee objects

## Database Schema

### Employee Table
- `employee_id`: String (Primary Key)
- `name`: String
- `department`: String
- `email`: String

## Setup and Installation

1. Create a virtual environment:
   ```bash
   python -m venv uenv
   source uenv/bin/activate  # On Windows: uenv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install fastapi uvicorn sqlalchemy pymysql pydantic
   ```

3. Configure the database:
   - Update the DATABASE_URL in `src/database/config.py`
   - Ensure MySQL is running and the database is created

4. Run the application:
   ```bash
   uvicorn app:app --reload
   ```

## Usage

1. Access the application at `http://localhost:8000`
2. Use the web interface to view and filter employee data
3. Use the API endpoints to programmatically interact with the data

## Development

The project uses FastAPI's automatic API documentation. You can access:
- Interactive API documentation: `http://localhost:8000/docs`
- Alternative API documentation: `http://localhost:8000/redoc`