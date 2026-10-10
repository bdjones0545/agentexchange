// Rasterize the existing public/brand AgentExchange vector mark as an opaque store icon.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(CGColor(red: 11/255, green: 18/255, blue: 20/255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
context.setFillColor(CGColor(red: 120/255, green: 240/255, blue: 188/255, alpha: 1))
for points: [[CGFloat]] in [[[44,16],[56,16],[78,54],[87,54],[73,69],[50,54],[63,54],[50,31],[23,78],[9,78]],[[40,61],[40,70],[71,70],[80,85],[40,85],[40,94],[23,77]]] {
 context.beginPath()
 for (index,p) in points.enumerated() {
  let point=CGPoint(x:p[0]*10.24,y:(100-p[1])*10.24)
  if index==0 { context.move(to:point) } else { context.addLine(to:point) }
 }
 context.closePath();context.fillPath()
}
let output=URL(fileURLWithPath: CommandLine.arguments[1])
let destination=CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
precondition(CGImageDestinationFinalize(destination))
