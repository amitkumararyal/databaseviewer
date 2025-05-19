from fastapi import Depends, Query, HTTPException
from sqlalchemy import and_, text, Table, MetaData, create_engine, select, func
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from sqlalchemy import inspect
import json

from src.database.config import get_db, engine

async def get_tables(db: Session = Depends(get_db)):
    try:
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        return JSONResponse(content={"tables": tables})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

async def get_table_structure(table_name: str, db: Session = Depends(get_db)):
    try:
        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=engine)
        
        columns = []
        for column in table.columns:
            col_info = {
                "name": str(column.name),
                "type": str(column.type),
                "nullable": column.nullable,
                "primary_key": column.primary_key,
                "default": str(column.default) if column.default else None,
                "autoincrement": getattr(column, 'autoincrement', False)
            }
            columns.append(col_info)
            
        foreign_keys = []
        for fk in table.foreign_keys:
            fk_info = {
                "column": fk.parent.name,
                "referred_table": fk.column.table.name,
                "referred_column": fk.column.name
            }
            foreign_keys.append(fk_info)
            
        return JSONResponse(content={
            "columns": columns,
            "foreign_keys": foreign_keys
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

async def fetch_table_data(
    table_name: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1),
    filters: Optional[str] = None
):
    try:
        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=engine)
        
        # Build base query
        query = select(table)
        count_query = select(func.count()).select_from(table)
        
        # Apply filters if any
        if filters:
            try:
                filter_list = [json.loads(f) for f in filters.split('|') if f]
                filter_conditions = []
                
                for filter_item in filter_list:
                    column = table.columns[filter_item['column']]
                    value = filter_item['value']
                    
                    if filter_item['type'] == "equals":
                        filter_conditions.append(column == value)
                    elif filter_item['type'] == "contains":
                        filter_conditions.append(column.ilike(f"%{value}%"))
                    elif filter_item['type'] == "startsWith":
                        filter_conditions.append(column.ilike(f"{value}%"))
                    elif filter_item['type'] == "endsWith":
                        filter_conditions.append(column.ilike(f"%{value}"))
                    elif filter_item['type'] == "greaterThan":
                        filter_conditions.append(column > value)
                    elif filter_item['type'] == "lessThan":
                        filter_conditions.append(column < value)
                    elif filter_item['type'] == "between":
                        filter_conditions.append(and_(
                            column >= value['min'],
                            column <= value['max']
                        ))
                    elif filter_item['type'] == "in":
                        filter_conditions.append(column.in_(value))

                if filter_conditions:
                    filter_condition = and_(*filter_conditions)
                    query = query.where(filter_condition)
                    count_query = count_query.where(filter_condition)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid filter format: {str(e)}")

        # Get total count
        total_count = db.scalar(count_query)

        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        # Execute query
        result = db.execute(query)
        rows = result.all()

        # Get column names
        columns = [c.name for c in table.columns]

        # Convert rows to list of values and handle different data types
        formatted_rows = []
        for row in rows:
            formatted_row = []
            for val in row:
                if hasattr(val, 'isoformat'):  # Handle datetime objects
                    formatted_row.append(val.isoformat())
                elif isinstance(val, (int, float, str, bool)) or val is None:
                    formatted_row.append(val)
                else:
                    formatted_row.append(str(val))  # Convert other types to string
            formatted_rows.append(formatted_row)

        data = {
            "columns": columns,
            "rows": formatted_rows,
            "total": total_count,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total_count + page_size - 1) // page_size
        }
        return JSONResponse(content=data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)