import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Device, Alarm, ModbusRegister, DeviceNote } from '../types'

const API_BASE = 'http://localhost:8002/api'

export const useModbusStore = defineStore('modbus', () => {
  const devices = ref<Device[]>([])
  const alarms = ref<Alarm[]>([])
  const deviceNotes = ref<Record<string, DeviceNote[]>>({})
  const historyData = ref<Record<string, { time: number[]; values: number[] }>>({})
  const isPolling = ref(false)
  const pollInterval = ref(1000)
  const selectedDevice = ref<Device | null>(null)
  const currentOperator = ref('值班员')

  const criticalAlarms = computed(() => alarms.value.filter(a => a.level === 'critical' && !a.acknowledged))
  const onlineDevices = computed(() => devices.value.filter(d => d.online))

  function initMockDevices() {
    devices.value = [
      {
        id: 'dev1', name: '温湿度传感器-A区', ip: '192.168.1.101', port: 502, slaveId: 1, online: true,
        registers: [
          { address: 0, name: '温度', type: 'holding', value: 25.6, unit: '°C', updatedAt: Date.now() },
          { address: 1, name: '湿度', type: 'holding', value: 62.3, unit: '%RH', updatedAt: Date.now() },
          { address: 2, name: '露点', type: 'holding', value: 17.8, unit: '°C', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev2', name: '压力变送器-B区', ip: '192.168.1.102', port: 502, slaveId: 2, online: true,
        registers: [
          { address: 0, name: '管道压力', type: 'holding', value: 3.45, unit: 'MPa', updatedAt: Date.now() },
          { address: 1, name: '差压', type: 'holding', value: 0.12, unit: 'kPa', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev3', name: '电机控制器-C区', ip: '192.168.1.103', port: 502, slaveId: 3, online: false,
        registers: [
          { address: 0, name: '转速', type: 'holding', value: 1480, unit: 'RPM', updatedAt: Date.now() },
          { address: 1, name: '电流', type: 'holding', value: 12.5, unit: 'A', updatedAt: Date.now() },
          { address: 2, name: '运行状态', type: 'coil', value: true, unit: '', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev4', name: '流量计-D区', ip: '192.168.1.104', port: 502, slaveId: 4, online: true,
        registers: [
          { address: 0, name: '瞬时流量', type: 'holding', value: 156.7, unit: 'L/min', updatedAt: Date.now() },
          { address: 1, name: '累计流量', type: 'holding', value: 98234, unit: 'L', updatedAt: Date.now() },
        ]
      },
    ]
    selectedDevice.value = devices.value[0]
  }

  async function fetchDeviceNotes(deviceId: string): Promise<DeviceNote[]> {
    try {
      const res = await fetch(`${API_BASE}/devices/${deviceId}/notes`)
      if (res.ok) {
        const notes = await res.json()
        deviceNotes.value[deviceId] = notes
        syncNotesToAlarms()
        return notes
      }
    } catch (e) {
      console.error('Failed to fetch device notes:', e)
    }
    return deviceNotes.value[deviceId] || []
  }

  async function addDeviceNote(deviceId: string, content: string): Promise<DeviceNote | null> {
    try {
      const res = await fetch(`${API_BASE}/devices/${deviceId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, operator: currentOperator.value })
      })
      if (res.ok) {
        const note = await res.json()
        if (!deviceNotes.value[deviceId]) deviceNotes.value[deviceId] = []
        deviceNotes.value[deviceId].push(note)
        syncNotesToAlarms()
        return note
      }
    } catch (e) {
      console.error('Failed to add device note:', e)
    }
    return null
  }

  async function updateDeviceNote(deviceId: string, noteId: string, content: string): Promise<DeviceNote | null> {
    try {
      const res = await fetch(`${API_BASE}/devices/${deviceId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        const updatedNote = await res.json()
        const notes = deviceNotes.value[deviceId]
        if (notes) {
          const idx = notes.findIndex(n => n.id === noteId)
          if (idx !== -1) notes[idx] = updatedNote
        }
        syncNotesToAlarms()
        return updatedNote
      }
    } catch (e) {
      console.error('Failed to update device note:', e)
    }
    return null
  }

  async function deleteDeviceNote(deviceId: string, noteId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/devices/${deviceId}/notes/${noteId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        const notes = deviceNotes.value[deviceId]
        if (notes) {
          deviceNotes.value[deviceId] = notes.filter(n => n.id !== noteId)
        }
        syncNotesToAlarms()
        return true
      }
    } catch (e) {
      console.error('Failed to delete device note:', e)
    }
    return false
  }

  function syncNotesToAlarms() {
    for (const alarm of alarms.value) {
      const notes = deviceNotes.value[alarm.deviceId]
      if (notes) {
        alarm.deviceNotes = [...notes]
      } else {
        alarm.deviceNotes = []
      }
    }
  }

  function simulatePoll() {
    for (const dev of devices.value) {
      if (!dev.online) continue
      for (const reg of dev.registers) {
        if (typeof reg.value === 'number') {
          const noise = (Math.random() - 0.5) * reg.value * 0.02
          reg.value = Math.round((reg.value + noise) * 100) / 100
          reg.updatedAt = Date.now()
          const key = `${dev.id}_${reg.address}`
          if (!historyData.value[key]) historyData.value[key] = { time: [], values: [] }
          historyData.value[key].time.push(Date.now())
          historyData.value[key].values.push(reg.value)
          if (historyData.value[key].time.length > 100) {
            historyData.value[key].time.shift()
            historyData.value[key].values.shift()
          }
          if (reg.name === '温度' && reg.value > 28) {
            const newAlarm: Alarm = {
              id: `a_${Date.now()}`, deviceId: dev.id, register: reg.name,
              message: `${dev.name} ${reg.name}超限: ${reg.value}${reg.unit}`,
              level: reg.value > 30 ? 'critical' : 'warning',
              timestamp: Date.now(), acknowledged: false,
              deviceNotes: deviceNotes.value[dev.id] ? [...deviceNotes.value[dev.id]] : []
            }
            alarms.value.unshift(newAlarm)
          }
        }
      }
    }
    if (alarms.value.length > 50) alarms.value = alarms.value.slice(0, 50)
  }

  function acknowledgeAlarm(id: string) {
    const a = alarms.value.find(a => a.id === id)
    if (a) a.acknowledged = true
  }

  function toggleDevice(id: string) {
    const d = devices.value.find(d => d.id === id)
    if (d) d.online = !d.online
  }

  return {
    devices, alarms, deviceNotes, historyData, isPolling, pollInterval, selectedDevice, currentOperator,
    criticalAlarms, onlineDevices,
    initMockDevices, simulatePoll, acknowledgeAlarm, toggleDevice,
    fetchDeviceNotes, addDeviceNote, updateDeviceNote, deleteDeviceNote
  }
})
