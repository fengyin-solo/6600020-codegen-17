from pydantic import BaseModel, Field
from typing import List, Optional

class ModbusRegister(BaseModel):
    address: int
    name: str
    type: str
    value: float
    unit: str

class Device(BaseModel):
    id: str
    name: str
    ip: str
    port: int
    slave_id: int
    online: bool
    registers: List[ModbusRegister] = []

class DeviceNote(BaseModel):
    id: str
    device_id: str
    content: str
    operator: str
    created_at: int
    updated_at: int

class DeviceNoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    operator: str = Field(..., min_length=1, max_length=50)

class DeviceNoteUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

class Alarm(BaseModel):
    id: str
    device_id: str
    register: str
    message: str
    level: str
    timestamp: int
    acknowledged: bool
    device_notes: List[DeviceNote] = []
