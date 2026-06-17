<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-900 p-4 flex flex-col gap-3 border-r border-gray-800 overflow-y-auto">
      <h1 class="text-lg font-bold text-orange-400">Modbus 工业监控</h1>
      <div class="flex gap-2">
        <button @click="startPoll" :disabled="store.isPolling" class="flex-1 bg-green-700 py-1.5 rounded text-xs hover:bg-green-600 disabled:opacity-50">
          {{ store.isPolling ? '采集中...' : '开始采集' }}
        </button>
        <button @click="stopPoll" :disabled="!store.isPolling" class="flex-1 bg-red-700 py-1.5 rounded text-xs hover:bg-red-600 disabled:opacity-50">
          停止
        </button>
      </div>
      <div>
        <label class="text-gray-400 text-xs">轮询间隔: {{ store.pollInterval }}ms</label>
        <input type="range" v-model.number="store.pollInterval" min="200" max="5000" step="100" class="w-full" />
      </div>
      <div>
        <label class="text-gray-400 text-xs">当前值班员:</label>
        <input type="text" v-model="store.currentOperator" class="w-full bg-gray-800 text-white text-xs px-2 py-1 rounded mt-1" placeholder="输入姓名" />
      </div>

      <h3 class="text-gray-400 text-xs mt-2">设备列表</h3>
      <div v-for="d in store.devices" :key="d.id" @click="selectDevice(d)"
        class="bg-gray-800 rounded p-2 cursor-pointer text-sm"
        :class="store.selectedDevice?.id === d.id ? 'ring-1 ring-orange-500' : ''">
        <div class="flex justify-between">
          <span>{{ d.name }}</span>
          <span class="w-2 h-2 rounded-full mt-1.5" :class="d.online ? 'bg-green-500' : 'bg-red-500'"></span>
        </div>
        <div class="text-xs text-gray-500">{{ d.ip }}:{{ d.port }} [{{ d.slaveId }}]</div>
        <div v-if="getNoteCount(d.id) > 0" class="text-xs text-orange-400 mt-1">
          📝 {{ getNoteCount(d.id) }} 条备注
        </div>
      </div>

      <div v-if="store.criticalAlarms.length" class="bg-red-900/50 rounded p-2 mt-2">
        <h4 class="text-red-400 text-xs font-bold">⚠ 严重告警 {{ store.criticalAlarms.length }}</h4>
        <div v-for="a in store.criticalAlarms.slice(0, 3)" :key="a.id" class="text-xs text-red-300 mt-1 truncate">
          {{ a.message }}
        </div>
      </div>

      <div class="text-xs text-gray-600 mt-auto">
        在线: {{ store.onlineDevices.length }}/{{ store.devices.length }}
      </div>
    </div>

    <!-- Main Dashboard -->
    <div class="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
      <!-- Register Gauges -->
      <div class="grid grid-cols-4 gap-3">
        <div v-for="d in store.devices" :key="d.id">
          <div v-for="r in d.registers" :key="r.address"
            class="bg-gray-900 rounded-xl p-3 mb-3">
            <div class="text-xs text-gray-400">{{ d.name }}</div>
            <div class="text-2xl font-bold" :class="d.online ? 'text-orange-400' : 'text-gray-600'">
              {{ typeof r.value === 'number' ? r.value.toFixed(r.value > 100 ? 0 : 1) : r.value ? 'ON' : 'OFF' }}
            </div>
            <div class="text-xs text-gray-500">{{ r.name }} {{ r.unit }}</div>
          </div>
        </div>
      </div>

      <div class="flex gap-3 flex-1 min-h-0">
        <!-- Chart -->
        <div class="flex-1 bg-gray-900 rounded-xl p-3 flex flex-col min-w-0">
          <h3 class="text-sm text-gray-400 mb-2">
            实时趋势 — {{ store.selectedDevice?.name || '选择设备' }}
          </h3>
          <TrendChart />
        </div>

        <!-- Device Notes Panel -->
        <div class="w-80 bg-gray-900 rounded-xl p-3 flex flex-col">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm text-gray-400">
              📝 设备备注 — {{ store.selectedDevice?.name || '选择设备' }}
            </h3>
            <span v-if="store.selectedDevice && getNotes(store.selectedDevice.id).length" 
                  class="text-xs text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded">
              {{ getNotes(store.selectedDevice.id).length }} 条
            </span>
          </div>

          <div v-if="store.selectedDevice" class="mb-3">
            <textarea 
              v-model="newNoteContent" 
              class="w-full bg-gray-800 text-white text-xs p-2 rounded resize-none"
              rows="3"
              placeholder="输入处理说明，如：已通知维修人员、正在排查..."
              maxlength="500"
            ></textarea>
            <div class="flex justify-between items-center mt-1">
              <span class="text-xs text-gray-500">{{ newNoteContent.length }}/500</span>
              <button 
                @click="submitNote" 
                :disabled="!newNoteContent.trim()"
                class="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-3 py-1 rounded">
                添加备注
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2">
            <div v-if="!store.selectedDevice" class="text-center text-gray-500 text-xs py-8">
              请先选择一个设备
            </div>
            <div v-else-if="getNotes(store.selectedDevice.id).length === 0" 
                 class="text-center text-gray-500 text-xs py-8">
              暂无备注，添加第一条处理说明
            </div>
            <div v-else 
                 v-for="note in getNotes(store.selectedDevice.id).slice().reverse()" 
                 :key="note.id"
                 class="bg-gray-800 rounded p-2 text-xs">
              <div v-if="editingNoteId === note.id">
                <textarea 
                  v-model="editContent" 
                  class="w-full bg-gray-700 text-white text-xs p-2 rounded resize-none"
                  rows="3"
                  maxlength="500"
                ></textarea>
                <div class="flex justify-end gap-2 mt-1">
                  <button @click="cancelEdit" class="text-gray-400 hover:text-white text-xs">取消</button>
                  <button @click="saveEdit(note)" class="text-green-400 hover:text-green-300 text-xs">保存</button>
                </div>
              </div>
              <div v-else>
                <div class="whitespace-pre-wrap text-gray-200">{{ note.content }}</div>
                <div class="flex justify-between items-center mt-2 text-gray-500">
                  <span>👤 {{ note.operator }}</span>
                  <span>{{ formatTime(note.updatedAt) }}</span>
                </div>
                <div class="flex justify-end gap-2 mt-1">
                  <button @click="startEdit(note)" class="text-blue-400 hover:text-blue-300 text-xs">编辑</button>
                  <button @click="removeNote(note)" class="text-red-400 hover:text-red-300 text-xs">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alarm List -->
      <div class="bg-gray-900 rounded-xl p-3 max-h-64 overflow-y-auto">
        <h3 class="text-sm text-gray-400 mb-2">告警记录</h3>
        <div v-for="a in store.alarms.slice(0, 10)" :key="a.id"
          class="text-xs bg-gray-800 rounded p-2 mb-1"
          :class="{ 'border-l-4 border-red-500': a.level === 'critical', 'border-l-4 border-yellow-500': a.level === 'warning' }">
          <div class="flex justify-between">
            <span>{{ a.message }}</span>
            <div class="flex gap-2">
              <span class="text-gray-500">{{ new Date(a.timestamp).toLocaleTimeString() }}</span>
              <button v-if="!a.acknowledged" @click="store.acknowledgeAlarm(a.id)" class="text-blue-400 hover:underline">确认</button>
            </div>
          </div>
          <div v-if="a.deviceNotes && a.deviceNotes.length > 0" class="mt-2 pt-2 border-t border-gray-700">
            <div class="text-orange-400 font-medium mb-1">📝 设备备注 ({{ a.deviceNotes.length }})</div>
            <div v-for="note in a.deviceNotes.slice(-2)" :key="note.id" class="text-gray-400 text-xs pl-2 border-l-2 border-orange-500/30 mb-1">
              <span class="text-orange-300">[{{ note.operator }}]</span> {{ note.content }}
              <span class="text-gray-500 ml-1">{{ formatTime(note.updatedAt) }}</span>
            </div>
          </div>
        </div>
        <div v-if="store.alarms.length === 0" class="text-center text-gray-500 text-xs py-4">
          暂无告警记录
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useModbusStore } from './store/modbus'
import TrendChart from './components/TrendChart.vue'
import type { Device, DeviceNote } from './types'

const store = useModbusStore()
let timer: number | null = null

const newNoteContent = ref('')
const editingNoteId = ref<string | null>(null)
const editContent = ref('')

function selectDevice(device: Device) {
  store.selectedDevice = device
  store.fetchDeviceNotes(device.id)
  editingNoteId.value = null
  newNoteContent.value = ''
}

function getNotes(deviceId: string): DeviceNote[] {
  return store.deviceNotes[deviceId] || []
}

function getNoteCount(deviceId: string): number {
  return getNotes(deviceId).length
}

async function submitNote() {
  if (!store.selectedDevice || !newNoteContent.value.trim()) return
  await store.addDeviceNote(store.selectedDevice.id, newNoteContent.value.trim())
  newNoteContent.value = ''
}

function startEdit(note: DeviceNote) {
  editingNoteId.value = note.id
  editContent.value = note.content
}

function cancelEdit() {
  editingNoteId.value = null
  editContent.value = ''
}

async function saveEdit(note: DeviceNote) {
  if (!store.selectedDevice || !editContent.value.trim()) return
  await store.updateDeviceNote(note.deviceId, note.id, editContent.value.trim())
  cancelEdit()
}

async function removeNote(note: DeviceNote) {
  if (!store.selectedDevice) return
  if (confirm('确定要删除这条备注吗？')) {
    await store.deleteDeviceNote(note.deviceId, note.id)
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function startPoll() {
  store.isPolling = true
  timer = window.setInterval(() => store.simulatePoll(), store.pollInterval)
}

function stopPoll() {
  store.isPolling = false
  if (timer) { clearInterval(timer); timer = null }
}

onMounted(() => {
  store.initMockDevices()
  if (store.selectedDevice) {
    store.fetchDeviceNotes(store.selectedDevice.id)
  }
})

onUnmounted(() => stopPoll())
</script>
