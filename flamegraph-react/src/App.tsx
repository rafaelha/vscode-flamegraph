import { FlameGraph, TreeNode } from './components/flame-graph'
import React, { useState, useEffect, useMemo } from 'react'
import './tailwind.css'

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

function sortTreeNodeChildren(node: TreeNode): TreeNode {
  // Sort current node's children
  if (node.children) {
    node.children.sort((a, b) => {
      // First compare by file
      const fileCompare = (a.file || '').localeCompare(b.file || '')
      if (fileCompare !== 0) return fileCompare
      // Then by line number
      return (a.line || 0) - (b.line || 0)
    })
    
    // Recursively sort children's children
    node.children.forEach(sortTreeNodeChildren)
  }
  
  return node
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

  return sortTreeNodeChildren(root)
}

function getUniqueModules(data: TreeNode): Array<{ name: string, color: string, totalValue: number }> {
  const moduleMap = new Map<string, { color: string, totalValue: number }>()

  function traverse(node: TreeNode) {
    if (node.file) {
      const moduleName = node.file.replace(/\//g, '\\').split('\\')[0]
      if (!moduleName.startsWith('<') && !moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, {
          color: getNodeColor(node.file, 1, 'dummy'),
          totalValue: node.value
        })
      } else if (!moduleName.startsWith('<')) {
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
    .slice(0, 3) // Take only top 5
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void
    }
  }
}

export default function Home() {
  const [parsedData, setParsedData] = useState<TreeNode | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'profile-data') {
        setParsedData(parseProfile(message.data))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const moduleColors = useMemo(() => 
    parsedData ? getUniqueModules(parsedData) : [], [parsedData]
  )

  if (!parsedData) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Loading profile data...</p>
    </div>
  }

  return (
    <div className="App min-h-screen relative">
      <div className="pb-12">
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