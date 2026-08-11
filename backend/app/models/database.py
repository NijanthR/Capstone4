from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def check_and_update_schema():
    from sqlalchemy import text
    with engine.connect() as conn:
        # Check if columns exist in paper_metadata table
        try:
            conn.execute(text("SELECT extracted_analysis FROM paper_metadata LIMIT 1"))
        except Exception:
            # Columns are missing, add them
            try:
                conn.execute(text("ALTER TABLE paper_metadata ADD COLUMN extracted_analysis TEXT"))
                conn.execute(text("ALTER TABLE paper_metadata ADD COLUMN comparison_results TEXT"))
                # Commit is automatic or needs explicit commit in SQLAlchemy 2.0 connection
                conn.commit()
                print("Altered paper_metadata table to add new columns successfully.")
            except Exception as alter_err:
                print(f"Error altering table: {alter_err}")

# Run schema update check on import/initialization
try:
    check_and_update_schema()
except Exception as e:
    print(f"Failed to check/update schema: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
