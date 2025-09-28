-- Create reports table for SilangEmergency database
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('Fire', 'Vehicular Accident', 'Flood', 'Earthquake', 'Electrical')),
    location VARCHAR(255) NOT NULL,
    urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('Low', 'Moderate', 'High')),
    description TEXT NOT NULL,
    media_urls TEXT[], -- Array to store multiple media file URLs
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_incident_type ON reports(incident_type);
CREATE INDEX IF NOT EXISTS idx_reports_urgency ON reports(urgency);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();



