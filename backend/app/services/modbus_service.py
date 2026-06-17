"""Modbus service with mock data (replace with pymodbus for production)."""
import random
import time
import uuid
from typing import List, Dict, Any, Optional
from app.models.schemas import DeviceNote, Alarm

MOCK_DEVICES = [
    {"id": "dev1", "name": "温湿度传感器-A区", "ip": "192.168.1.101", "port": 502, "slave_id": 1, "online": True},
    {"id": "dev2", "name": "压力变送器-B区", "ip": "192.168.1.102", "port": 502, "slave_id": 2, "online": True},
    {"id": "dev3", "name": "电机控制器-C区", "ip": "192.168.1.103", "port": 502, "slave_id": 3, "online": False},
    {"id": "dev4", "name": "流量计-D区", "ip": "192.168.1.104", "port": 502, "slave_id": 4, "online": True},
]

DEVICE_NOTES: Dict[str, List[DeviceNote]] = {}

MOCK_ALARMS: List[Alarm] = []

def get_device_status() -> List[Dict[str, Any]]:
    return MOCK_DEVICES

def read_registers(device_id: str, address: int, count: int) -> Dict[str, Any]:
    """Read registers via pymodbus (mock implementation)."""
    values = [round(random.uniform(0, 100), 2) for _ in range(count)]
    return {"device_id": device_id, "address": address, "values": values}

def get_device_notes(device_id: str) -> List[DeviceNote]:
    """Get all notes for a specific device."""
    return DEVICE_NOTES.get(device_id, [])

def create_device_note(device_id: str, content: str, operator: str) -> DeviceNote:
    """Create a new note for a device."""
    now = int(time.time() * 1000)
    note = DeviceNote(
        id=str(uuid.uuid4()),
        device_id=device_id,
        content=content,
        operator=operator,
        created_at=now,
        updated_at=now
    )
    if device_id not in DEVICE_NOTES:
        DEVICE_NOTES[device_id] = []
    DEVICE_NOTES[device_id].append(note)
    return note

def update_device_note(device_id: str, note_id: str, content: str) -> Optional[DeviceNote]:
    """Update an existing device note."""
    notes = DEVICE_NOTES.get(device_id, [])
    for note in notes:
        if note.id == note_id:
            note.content = content
            note.updated_at = int(time.time() * 1000)
            return note
    return None

def delete_device_note(device_id: str, note_id: str) -> bool:
    """Delete a device note."""
    notes = DEVICE_NOTES.get(device_id, [])
    for i, note in enumerate(notes):
        if note.id == note_id:
            notes.pop(i)
            return True
    return False

def get_alarms_with_notes() -> List[Dict[str, Any]]:
    """Get all alarms with device notes attached."""
    result = []
    for alarm in MOCK_ALARMS:
        alarm_dict = alarm.model_dump()
        alarm_dict["device_notes"] = get_device_notes(alarm.device_id)
        result.append(alarm_dict)
    return result

def attach_notes_to_alarm(alarm_data: Dict[str, Any]) -> Dict[str, Any]:
    """Attach device notes to a single alarm."""
    device_id = alarm_data.get("device_id")
    if device_id:
        alarm_data["device_notes"] = get_device_notes(device_id)
    return alarm_data

def add_mock_alarm(alarm: Alarm) -> None:
    """Add a mock alarm for testing."""
    MOCK_ALARMS.append(alarm)
