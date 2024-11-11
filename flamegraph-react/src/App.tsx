import { FlameGraph, TreeNode } from './components/flame-graph'
import React, { useState, useMemo } from 'react'
import './tailwind.css'

const MYDATA = `<module> (myproject/profile_test.py:20);main (myproject/profile_test.py:10);<listcomp> (myproject/profile_test.py:10) 26
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17);main (myproject/profile_test.py:12);<listcomp> (myproject/profile_test.py:12) 56
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17);main (myproject/profile_test.py:10) 8
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17);main (myproject/profile_test.py:10);<listcomp> (myproject/profile_test.py:10) 33
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17);main (myproject/profile_test.py:11);<listcomp> (myproject/profile_test.py:11) 94
<module> (myproject/profile_test.py:20) 25
<module> (myproject/profile_test.py:22);external_func (myproject/external_func.py:5);<listcomp> (myproject/external_func.py:5) 73
 4
<module> (myproject/profile_test.py:22);external_func (myproject/external_func.py:4) 2
<module> (myproject/profile_test.py:20);main (myproject/profile_test.py:11) 33
<module> (myproject/profile_test.py:22);external_func (myproject/external_func.py:3) 2
<module> (myproject/profile_test.py:1);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/__init__.py:159);_handle_fromlist (<frozen importlib._bootstrap>:1232);_call_with_frames_removed (<frozen importlib._bootstrap>:241);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/ma/__init__.py:42);_handle_fromlist (<frozen importlib._bootstrap>:1232);_call_with_frames_removed (<frozen importlib._bootstrap>:241);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/ma/core.py:24);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (inspect.py:2654) 1
<module> (myproject/profile_test.py:20);main (myproject/profile_test.py:11);<listcomp> (myproject/profile_test.py:11) 112
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17);main (myproject/profile_test.py:11) 21
<module> (myproject/profile_test.py:20);main (myproject/profile_test.py:10) 10
<module> (myproject/profile_test.py:22);external_func (myproject/external_func.py:5) 20
<module> (myproject/profile_test.py:21);outer_func (myproject/profile_test.py:17) 10
<module> (myproject/profile_test.py:1);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/__init__.py:157);_handle_fromlist (<frozen importlib._bootstrap>:1232);_call_with_frames_removed (<frozen importlib._bootstrap>:241);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/random/__init__.py:180);_handle_fromlist (<frozen importlib._bootstrap>:1232);_call_with_frames_removed (<frozen importlib._bootstrap>:241);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:690);exec_module (<frozen importlib._bootstrap_external>:940);_call_with_frames_removed (<frozen importlib._bootstrap>:241);<module> (numpy/random/_pickle.py:2);_find_and_load (<frozen importlib._bootstrap>:1176);_find_and_load_unlocked (<frozen importlib._bootstrap>:1147);_load_unlocked (<frozen importlib._bootstrap>:676);module_from_spec (<frozen importlib._bootstrap>:573);create_module (<frozen importlib._bootstrap_external>:1233);_call_with_frames_removed (<frozen importlib._bootstrap>:241) 1
<module> (myproject/profile_test.py:20);main (myproject/profile_test.py:12);<listcomp> (myproject/profile_test.py:12) 78`

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getNodeColor(file?: string, line?: number, functionName?: string): string {
  if (!file || !line || !functionName) return '#808080'

  const moduleName = file.replace(/\//g, '\\').split('\\')[0]

  const hue = (hashString(moduleName ?? '') + 50) % 360
  const saturation = 50 + (hashString(functionName) % 50)
  const lightness = 25 + (line % 10)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function parseProfile(data: string): TreeNode {
  const lines = data.trim().split('\n')
  const root: TreeNode = {
    uid: 0,
    name: "all",
    value: 0,
    file: "",
    line: 0,
    depth: 0,
    fileLineId: -1,
    color: '#808080',
    children: []
  }

  let uid = 0
  const fileLineToInt: Record<string, number> = {}

  lines.forEach(originalLine => {
    const line = originalLine.trim();
    if (line === '') {
        return; // Skip empty lines
    }

    // Separate the call stack from the sample count
    const lastSpaceIndex = line.lastIndexOf(' ');
    if (lastSpaceIndex === -1) {
        return;
    }

    const callStackStr = line.substring(0, lastSpaceIndex);
    const numSamplesStr = line.substring(lastSpaceIndex + 1);
    const value = parseInt(numSamplesStr, 10)
    if (isNaN(value)) {
      console.warn(`Invalid number of samples: "${numSamplesStr}" in line: ${line}`)
      return
    }


    const frames = callStackStr.split(';')
    let currentNode = root
    let currentDepth = 0

    
    frames.forEach(frame => {
      // const regex = /\s*(\w+)\s+\(([^:]+):(\d+)\)/;
      const regex = /\s*([<\w]+>?)\s+\(([^:]+):(\d+)\)/;
      const match = frame.match(regex)
      if (!match) {
        console.warn(`Invalid frame format: "${frame}"`)
        return
      }

      const [, name, file, lineStr] = match
      const line = parseInt(lineStr, 10)

      const fileLineKey = `${file}:${line}`
      if (!fileLineToInt[fileLineKey]) {
        fileLineToInt[fileLineKey] = uid
      }

      let childNode = currentNode.children?.find(child => child.name === name && child.file === file && child.line === line)
      currentDepth++
      uid++
      if (!childNode) {
        childNode = { uid, name, file, line, value: 0, color: getNodeColor(file, line, name), children: [], parent: currentNode, depth: currentDepth, fileLineId: fileLineToInt[fileLineKey] }
        currentNode.children?.push(childNode)
      }

      childNode.value += value
      currentNode = childNode
    })
    root.value += value
  })

  return root
}

function getUniqueModules(data: TreeNode): Array<{ name: string, color: string, totalValue: number }> {
  const moduleMap = new Map<string, { color: string, totalValue: number }>()

  function traverse(node: TreeNode) {
    if (node.file) {
      const moduleName = node.file.replace(/\//g, '\\').split('\\')[0]
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, {
          color: getNodeColor(node.file, 1, 'dummy'),
          totalValue: node.value
        })
      } else {
        const current = moduleMap.get(moduleName)!
        moduleMap.set(moduleName, {
          ...current,
          totalValue: current.totalValue + node.value
        })
      }
    }
    node.children?.forEach(traverse)
  }

  traverse(data)

  // Convert to array and sort by total value
  return Array.from(moduleMap.entries())
    .map(([name, { color, totalValue }]) => ({ name, color, totalValue }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5) // Take only top 5
}

export default function Home() {
  const [parsedData, setParsedData] = useState<TreeNode>(parseProfile(MYDATA))

  const moduleColors = useMemo(() => getUniqueModules(parsedData), [parsedData])

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        setParsedData(parseProfile(content))
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="App min-h-screen relative">
      <div className="pb-12">
        <div className="mb-4">
          <label htmlFor="file-upload" className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Upload Profile File
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        <FlameGraph data={parsedData} />
      </div>
      
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            {moduleColors.map(({ name, color }) => (
              <div key={name} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-white/80">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}