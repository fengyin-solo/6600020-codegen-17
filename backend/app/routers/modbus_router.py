from fastapi import APIRouter, HTTPException
from typing import List
from app.services.modbus_service import (
    read_registers, get_device_status,
    get_device_notes, create_device_note,
    update_device_note, delete_device_note,
    get_alarms_with_notes, add_mock_alarm
)
from app.models.schemas import DeviceNote, DeviceNoteCreate, DeviceNoteUpdate, Alarm

router = APIRouter()

@router.get("/modbus/devices")
def list_devices():
    return get_device_status()

@router.get("/modbus/read/{device_id}/{address}/{count}")
def read_holding(device_id: str, address: int, count: int = 1):
    """Read holding registers from a Modbus device."""
    return read_registers(device_id, address, count)

@router.post("/modbus/write/{device_id}/{address}")
def write_register(device_id: str, address: int, value: int):
    return {"device_id": device_id, "address": address, "value": value, "status": "written"}

@router.get("/devices/{device_id}/notes", response_model=List[DeviceNote])
def list_device_notes(device_id: str):
    """Get all notes for a specific device."""
    return get_device_notes(device_id)

@router.post("/devices/{device_id}/notes", response_model=DeviceNote)
def add_device_note(device_id: str, note_data: DeviceNoteCreate):
    """Add a new note for a device."""
    return create_device_note(device_id, note_data.content, note_data.operator)

@router.put("/devices/{device_id}/notes/{note_id}", response_model=DeviceNote)
def edit_device_note(device_id: str, note_id: str, note_data: DeviceNoteUpdate):
    """Update an existing device note."""
    note = update_device_note(device_id, note_id, note_data.content)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.delete("/devices/{device_id}/notes/{note_id}")
def remove_device_note(device_id: str, note_id: str):
    """Delete a device note."""
    success = delete_device_note(device_id, note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "success", "message": "Note deleted"}

@router.get("/alarms")
def list_alarms():
    """Get all alarms with device notes attached."""
    return get_alarms_with_notes()

@router.post("/alarms/test")
def create_test_alarm(alarm: Alarm):
    """Create a test alarm for debugging."""
    add_mock_alarm(alarm)
    return {"status": "success", "message": "Test alarm created"}
