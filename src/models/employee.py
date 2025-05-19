from sqlalchemy import Column, String, MetaData, Table, inspect
from pydantic import BaseModel, create_model
from typing import Any, Dict, List
from src.database.config import Base, engine

class DynamicTable:
    def __init__(self, table_name: str):
        self.metadata = MetaData()
        self.table = None
        self.model = None
        if table_name:
            # Get table structure from database
            insp = inspect(engine)
            if table_name in insp.get_table_names():
                # Use autoload_with for proper table reflection
                self.table = Table(table_name, self.metadata, autoload_with=engine)
                # Create dynamic Pydantic model for validation
                fields = {
                    col.name: (eval(col.type.python_type.__name__), ...) 
                    for col in self.table.columns
                }
                self.model = create_model(f"{table_name.title()}Model", **fields)

class FilterCriteria(BaseModel):
    column: str
    type: str
    value: Any