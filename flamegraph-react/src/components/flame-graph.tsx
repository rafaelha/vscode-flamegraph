import React, { useState, useEffect } from 'react'
import './flame-graph.css'
import { vscode } from '../utilities/vscode'

export interface TreeNode {
  uid: number
  name: string
  value: number
  depth: number
  color: string
  fileLineId: number
  file?: string
  line?: number
  children?: TreeNode[]
  parent?: TreeNode
}

interface FlameGraphProps {
  data: TreeNode
  height?: number
}

export function FlameGraph({ data, height = 23 }: FlameGraphProps) {
  const [focusNode, setFocusNode] = useState<TreeNode>(data)
  const [hoveredLineId, setHoveredLineId] = useState<number | null>(null)
  const [isCommandPressed, setIsCommandPressed] = useState(false)

  React.useEffect(() => {
    setFocusNode(data)
  }, [data])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        setIsCommandPressed(true)
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) {
        setIsCommandPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', () => setIsCommandPressed(false))

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', () => setIsCommandPressed(false))
    }
  }, [])

  function renderNode(node: TreeNode, x: number, width: number) {
    const isHovered = hoveredLineId === node.fileLineId
    const style = {
      left: `${x * 100}%`,
      width: `calc(${width * 100}% - 2px)`,
      top: `${node.depth * height}px`,
      height: `${height - 2}px`,
      backgroundColor: node.color,
      position: 'absolute' as const,
      borderRadius: '2px',
      color: 'white',
      textShadow: '0 0 2px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      opacity: node.depth < focusNode.depth ? 0.35 : 1,
    }

    const handleClick = (e: React.MouseEvent) => {
      if ((e.metaKey || e.ctrlKey) && node.file && node.line) {
        // Send message to extension
        vscode.postMessage({
          command: 'open-file',
          file: node.file,
          line: node.line
        })
      } else {
        setFocusNode(node)
      }
    }

    const className = `graph-node ${
      isHovered && isCommandPressed ? 'same-line-id command-pressed' : ''
    }`

    return (
      <div
        key={node.uid}
        className={className}
        style={style}
        onClick={handleClick}
        onMouseEnter={() => setHoveredLineId(node.fileLineId)}
        onMouseLeave={() => setHoveredLineId(null)}
      >
        {renderNodeContent(node)}
      </div>
    )
  }

  function renderNodes(): React.ReactNode[] {
    const nodes: React.ReactNode[] = []

    // Render parents (full width)
    let current = focusNode
    while (current.parent) {
      nodes.push(renderNode(current.parent, 0, 1))
      current = current.parent
    }

    // Render focus node
    nodes.push(renderNode(focusNode, 0, 1))

    // Render children
    function renderChildren(node: TreeNode, startX: number) {
      let currentX = startX
      
      node.children?.forEach(child => {
        const childWidth = (child.value / focusNode.value)
        nodes.push(renderNode(child, currentX, childWidth))
        if (childWidth >= 0.009) {
          // Only process children in parent is large enough to be visible
          renderChildren(child, currentX)
        }
        currentX += childWidth
      })
    }

    renderChildren(focusNode, 0)

    return nodes
  }

  function renderNodeContent(node: TreeNode) {
    const fileName = node.file ? node.file.split('/').pop() : 'unknown.js'
    const lineNumber = node.line || 1
    const fileInfo = `${fileName}:${lineNumber}`
    
    return (
      <div className="node-label" style={{ 
        display: 'flex', 
        width: '100%', 
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        overflow: 'hidden',
        gap: '2px',
      }}>
        <span style={{ 
          flexShrink: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
        {node.file && node.line && (
          <span style={{ 
            flexShrink: 0,
          }}>
            {fileInfo}
          </span>
        )}
      </div>
    )
  }



  return (
    <div className="flamegraph">
      {renderNodes()}
    </div>
  )
}