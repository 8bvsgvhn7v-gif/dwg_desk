import AppKit
let size = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
NSColor(calibratedRed:0.08,green:0.13,blue:0.16,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:55,y:55,width:914,height:914),xRadius:205,yRadius:205).fill()
let accent=NSColor(calibratedRed:0.65,green:0.92,blue:0.74,alpha:1)
accent.setStroke()
let p=NSBezierPath();p.lineWidth=23;p.lineJoinStyle = .round;p.lineCapStyle = .round
p.move(to:NSPoint(x:270,y:295));p.line(to:NSPoint(x:270,y:745));p.line(to:NSPoint(x:750,y:745));p.line(to:NSPoint(x:750,y:295));p.line(to:NSPoint(x:270,y:295));
p.move(to:NSPoint(x:270,y:480));p.line(to:NSPoint(x:505,y:480));p.line(to:NSPoint(x:505,y:745));p.move(to:NSPoint(x:505,y:480));p.line(to:NSPoint(x:750,y:480));p.stroke()
let q=NSBezierPath();q.lineWidth=9
q.move(to:NSPoint(x:270,y:210));q.line(to:NSPoint(x:750,y:210));q.move(to:NSPoint(x:245,y:185));q.line(to:NSPoint(x:295,y:235));q.move(to:NSPoint(x:725,y:185));q.line(to:NSPoint(x:775,y:235));q.stroke()
accent.setFill();for (x,y) in [(270,295),(750,745)] {NSBezierPath(ovalIn:NSRect(x:x-23,y:y-23,width:46,height:46)).fill()}
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
