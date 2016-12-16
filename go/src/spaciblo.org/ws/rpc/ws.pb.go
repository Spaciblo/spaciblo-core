// Code generated by protoc-gen-go.
// source: ws.proto
// DO NOT EDIT!

/*
Package wsRPC is a generated protocol buffer package.

It is generated from these files:
	ws.proto

It has these top-level messages:
	Ping
	Ack
	SpaceUpdate
	Setting
	NodeUpdate
	Addition
*/
package wsRPC

import proto "github.com/golang/protobuf/proto"
import fmt "fmt"
import math "math"

import (
	context "golang.org/x/net/context"
	grpc "google.golang.org/grpc"
)

// Reference imports to suppress errors if they are not otherwise used.
var _ = proto.Marshal
var _ = fmt.Errorf
var _ = math.Inf

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.ProtoPackageIsVersion2 // please upgrade the proto package

type Ping struct {
	Name string `protobuf:"bytes,1,opt,name=name" json:"name,omitempty"`
}

func (m *Ping) Reset()                    { *m = Ping{} }
func (m *Ping) String() string            { return proto.CompactTextString(m) }
func (*Ping) ProtoMessage()               {}
func (*Ping) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{0} }

func (m *Ping) GetName() string {
	if m != nil {
		return m.Name
	}
	return ""
}

type Ack struct {
	Message string `protobuf:"bytes,1,opt,name=message" json:"message,omitempty"`
}

func (m *Ack) Reset()                    { *m = Ack{} }
func (m *Ack) String() string            { return proto.CompactTextString(m) }
func (*Ack) ProtoMessage()               {}
func (*Ack) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{1} }

func (m *Ack) GetMessage() string {
	if m != nil {
		return m.Message
	}
	return ""
}

type SpaceUpdate struct {
	SpaceUUID   string        `protobuf:"bytes,1,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	Frame       int64         `protobuf:"varint,2,opt,name=frame" json:"frame,omitempty"`
	ClientUUIDs []string      `protobuf:"bytes,3,rep,name=clientUUIDs" json:"clientUUIDs,omitempty"`
	NodeUpdates []*NodeUpdate `protobuf:"bytes,4,rep,name=nodeUpdates" json:"nodeUpdates,omitempty"`
	Additions   []*Addition   `protobuf:"bytes,5,rep,name=additions" json:"additions,omitempty"`
	Deletions   []int64       `protobuf:"varint,6,rep,packed,name=deletions" json:"deletions,omitempty"`
}

func (m *SpaceUpdate) Reset()                    { *m = SpaceUpdate{} }
func (m *SpaceUpdate) String() string            { return proto.CompactTextString(m) }
func (*SpaceUpdate) ProtoMessage()               {}
func (*SpaceUpdate) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{2} }

func (m *SpaceUpdate) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *SpaceUpdate) GetFrame() int64 {
	if m != nil {
		return m.Frame
	}
	return 0
}

func (m *SpaceUpdate) GetClientUUIDs() []string {
	if m != nil {
		return m.ClientUUIDs
	}
	return nil
}

func (m *SpaceUpdate) GetNodeUpdates() []*NodeUpdate {
	if m != nil {
		return m.NodeUpdates
	}
	return nil
}

func (m *SpaceUpdate) GetAdditions() []*Addition {
	if m != nil {
		return m.Additions
	}
	return nil
}

func (m *SpaceUpdate) GetDeletions() []int64 {
	if m != nil {
		return m.Deletions
	}
	return nil
}

type Setting struct {
	Key   string `protobuf:"bytes,1,opt,name=key" json:"key,omitempty"`
	Value string `protobuf:"bytes,2,opt,name=value" json:"value,omitempty"`
}

func (m *Setting) Reset()                    { *m = Setting{} }
func (m *Setting) String() string            { return proto.CompactTextString(m) }
func (*Setting) ProtoMessage()               {}
func (*Setting) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{3} }

func (m *Setting) GetKey() string {
	if m != nil {
		return m.Key
	}
	return ""
}

func (m *Setting) GetValue() string {
	if m != nil {
		return m.Value
	}
	return ""
}

type NodeUpdate struct {
	Id          int64      `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	Settings    []*Setting `protobuf:"bytes,2,rep,name=settings" json:"settings,omitempty"`
	Position    []float64  `protobuf:"fixed64,3,rep,packed,name=position" json:"position,omitempty"`
	Orientation []float64  `protobuf:"fixed64,4,rep,packed,name=orientation" json:"orientation,omitempty"`
	Translation []float64  `protobuf:"fixed64,5,rep,packed,name=translation" json:"translation,omitempty"`
	Rotation    []float64  `protobuf:"fixed64,6,rep,packed,name=rotation" json:"rotation,omitempty"`
	Scale       []float64  `protobuf:"fixed64,7,rep,packed,name=scale" json:"scale,omitempty"`
}

func (m *NodeUpdate) Reset()                    { *m = NodeUpdate{} }
func (m *NodeUpdate) String() string            { return proto.CompactTextString(m) }
func (*NodeUpdate) ProtoMessage()               {}
func (*NodeUpdate) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{4} }

func (m *NodeUpdate) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

func (m *NodeUpdate) GetSettings() []*Setting {
	if m != nil {
		return m.Settings
	}
	return nil
}

func (m *NodeUpdate) GetPosition() []float64 {
	if m != nil {
		return m.Position
	}
	return nil
}

func (m *NodeUpdate) GetOrientation() []float64 {
	if m != nil {
		return m.Orientation
	}
	return nil
}

func (m *NodeUpdate) GetTranslation() []float64 {
	if m != nil {
		return m.Translation
	}
	return nil
}

func (m *NodeUpdate) GetRotation() []float64 {
	if m != nil {
		return m.Rotation
	}
	return nil
}

func (m *NodeUpdate) GetScale() []float64 {
	if m != nil {
		return m.Scale
	}
	return nil
}

type Addition struct {
	Id           int64      `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	Settings     []*Setting `protobuf:"bytes,2,rep,name=settings" json:"settings,omitempty"`
	Position     []float64  `protobuf:"fixed64,3,rep,packed,name=position" json:"position,omitempty"`
	Orientation  []float64  `protobuf:"fixed64,4,rep,packed,name=orientation" json:"orientation,omitempty"`
	Translation  []float64  `protobuf:"fixed64,5,rep,packed,name=translation" json:"translation,omitempty"`
	Rotation     []float64  `protobuf:"fixed64,6,rep,packed,name=rotation" json:"rotation,omitempty"`
	Scale        []float64  `protobuf:"fixed64,7,rep,packed,name=scale" json:"scale,omitempty"`
	Parent       int64      `protobuf:"varint,8,opt,name=parent" json:"parent,omitempty"`
	TemplateUUID string     `protobuf:"bytes,9,opt,name=templateUUID" json:"templateUUID,omitempty"`
}

func (m *Addition) Reset()                    { *m = Addition{} }
func (m *Addition) String() string            { return proto.CompactTextString(m) }
func (*Addition) ProtoMessage()               {}
func (*Addition) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{5} }

func (m *Addition) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

func (m *Addition) GetSettings() []*Setting {
	if m != nil {
		return m.Settings
	}
	return nil
}

func (m *Addition) GetPosition() []float64 {
	if m != nil {
		return m.Position
	}
	return nil
}

func (m *Addition) GetOrientation() []float64 {
	if m != nil {
		return m.Orientation
	}
	return nil
}

func (m *Addition) GetTranslation() []float64 {
	if m != nil {
		return m.Translation
	}
	return nil
}

func (m *Addition) GetRotation() []float64 {
	if m != nil {
		return m.Rotation
	}
	return nil
}

func (m *Addition) GetScale() []float64 {
	if m != nil {
		return m.Scale
	}
	return nil
}

func (m *Addition) GetParent() int64 {
	if m != nil {
		return m.Parent
	}
	return 0
}

func (m *Addition) GetTemplateUUID() string {
	if m != nil {
		return m.TemplateUUID
	}
	return ""
}

func init() {
	proto.RegisterType((*Ping)(nil), "wsRPC.Ping")
	proto.RegisterType((*Ack)(nil), "wsRPC.Ack")
	proto.RegisterType((*SpaceUpdate)(nil), "wsRPC.SpaceUpdate")
	proto.RegisterType((*Setting)(nil), "wsRPC.Setting")
	proto.RegisterType((*NodeUpdate)(nil), "wsRPC.NodeUpdate")
	proto.RegisterType((*Addition)(nil), "wsRPC.Addition")
}

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConn

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion4

// Client API for WSHost service

type WSHostClient interface {
	// Test whether a sim host is responsive
	HandlePing(ctx context.Context, in *Ping, opts ...grpc.CallOption) (*Ack, error)
	// Send space updates to WS clients
	SendSpaceUpdate(ctx context.Context, in *SpaceUpdate, opts ...grpc.CallOption) (*Ack, error)
}

type wSHostClient struct {
	cc *grpc.ClientConn
}

func NewWSHostClient(cc *grpc.ClientConn) WSHostClient {
	return &wSHostClient{cc}
}

func (c *wSHostClient) HandlePing(ctx context.Context, in *Ping, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/wsRPC.WSHost/HandlePing", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *wSHostClient) SendSpaceUpdate(ctx context.Context, in *SpaceUpdate, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/wsRPC.WSHost/SendSpaceUpdate", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Server API for WSHost service

type WSHostServer interface {
	// Test whether a sim host is responsive
	HandlePing(context.Context, *Ping) (*Ack, error)
	// Send space updates to WS clients
	SendSpaceUpdate(context.Context, *SpaceUpdate) (*Ack, error)
}

func RegisterWSHostServer(s *grpc.Server, srv WSHostServer) {
	s.RegisterService(&_WSHost_serviceDesc, srv)
}

func _WSHost_HandlePing_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(Ping)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WSHostServer).HandlePing(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsRPC.WSHost/HandlePing",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WSHostServer).HandlePing(ctx, req.(*Ping))
	}
	return interceptor(ctx, in, info, handler)
}

func _WSHost_SendSpaceUpdate_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SpaceUpdate)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WSHostServer).SendSpaceUpdate(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsRPC.WSHost/SendSpaceUpdate",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WSHostServer).SendSpaceUpdate(ctx, req.(*SpaceUpdate))
	}
	return interceptor(ctx, in, info, handler)
}

var _WSHost_serviceDesc = grpc.ServiceDesc{
	ServiceName: "wsRPC.WSHost",
	HandlerType: (*WSHostServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "HandlePing",
			Handler:    _WSHost_HandlePing_Handler,
		},
		{
			MethodName: "SendSpaceUpdate",
			Handler:    _WSHost_SendSpaceUpdate_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "ws.proto",
}

func init() { proto.RegisterFile("ws.proto", fileDescriptor0) }

var fileDescriptor0 = []byte{
	// 429 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x09, 0x6e, 0x88, 0x02, 0xff, 0xdc, 0x53, 0xdd, 0x8a, 0xd4, 0x30,
	0x14, 0xb6, 0xcd, 0x4c, 0xa7, 0x3d, 0x95, 0x5d, 0x3d, 0x88, 0x94, 0x41, 0xb0, 0xe4, 0xc6, 0x22,
	0x38, 0xe0, 0xce, 0x13, 0x2c, 0x7a, 0xb1, 0xde, 0xc8, 0x92, 0x61, 0xf1, 0x3a, 0x36, 0xd9, 0xa5,
	0x4c, 0x27, 0x29, 0x4d, 0x74, 0xf1, 0x3d, 0x7c, 0x3a, 0xef, 0x7d, 0x0f, 0xc9, 0x4f, 0xa7, 0xdd,
	0x57, 0xf0, 0xae, 0xdf, 0x77, 0xbe, 0x73, 0x72, 0xbe, 0xaf, 0x09, 0xe4, 0x8f, 0x66, 0x37, 0x8c,
	0xda, 0x6a, 0x5c, 0x3f, 0x1a, 0x76, 0xfb, 0x89, 0x6e, 0x61, 0x75, 0xdb, 0xa9, 0x07, 0x44, 0x58,
	0x29, 0x7e, 0x92, 0x55, 0x52, 0x27, 0x4d, 0xc1, 0xfc, 0x37, 0x7d, 0x0b, 0xe4, 0xba, 0x3d, 0x62,
	0x05, 0x9b, 0x93, 0x34, 0x86, 0x3f, 0x4c, 0xd5, 0x09, 0xd2, 0xbf, 0x09, 0x94, 0x87, 0x81, 0xb7,
	0xf2, 0x6e, 0x10, 0xdc, 0x4a, 0x7c, 0x03, 0x85, 0xf1, 0xf0, 0xee, 0xcb, 0xe7, 0xa8, 0x9d, 0x09,
	0x7c, 0x05, 0xeb, 0xfb, 0xd1, 0x9d, 0x91, 0xd6, 0x49, 0x43, 0x58, 0x00, 0x58, 0x43, 0xd9, 0xf6,
	0x9d, 0x54, 0xd6, 0x69, 0x4c, 0x45, 0x6a, 0xd2, 0x14, 0x6c, 0x49, 0xe1, 0x1e, 0x4a, 0xa5, 0x45,
	0x3c, 0xc3, 0x54, 0xab, 0x9a, 0x34, 0xe5, 0xd5, 0xcb, 0x9d, 0xdf, 0x7f, 0xf7, 0xf5, 0x5c, 0x61,
	0x4b, 0x15, 0x7e, 0x80, 0x82, 0x0b, 0xd1, 0xd9, 0x4e, 0x2b, 0x53, 0xad, 0x7d, 0xcb, 0x65, 0x6c,
	0xb9, 0x8e, 0x3c, 0x9b, 0x15, 0x6e, 0x73, 0x21, 0x7b, 0x19, 0xe4, 0x59, 0x4d, 0x1a, 0xc2, 0x66,
	0x82, 0x7e, 0x84, 0xcd, 0x41, 0x5a, 0xeb, 0x72, 0x7a, 0x01, 0xe4, 0x28, 0x7f, 0x45, 0x73, 0xee,
	0xd3, 0xd9, 0xfa, 0xc9, 0xfb, 0x1f, 0xc1, 0x56, 0xc1, 0x02, 0xa0, 0x7f, 0x12, 0x80, 0x79, 0x37,
	0xbc, 0x80, 0xb4, 0x13, 0xbe, 0x8b, 0xb0, 0xb4, 0x13, 0xf8, 0x1e, 0x72, 0x13, 0x26, 0x9a, 0x2a,
	0xf5, 0xdb, 0x5d, 0xc4, 0xed, 0xe2, 0x41, 0xec, 0x5c, 0xc7, 0x2d, 0xe4, 0x83, 0x36, 0x7e, 0x51,
	0x1f, 0x4f, 0xc2, 0xce, 0xd8, 0xa5, 0xa7, 0x47, 0x17, 0x15, 0xf7, 0xe5, 0x95, 0x2f, 0x2f, 0x29,
	0xa7, 0xb0, 0x23, 0x57, 0xa6, 0x0f, 0x8a, 0x75, 0x50, 0x2c, 0x28, 0x37, 0x7f, 0xd4, 0x71, 0x40,
	0x16, 0xe6, 0x4f, 0xd8, 0x99, 0x33, 0x2d, 0xef, 0x65, 0xb5, 0xf1, 0x85, 0x00, 0xe8, 0xef, 0x14,
	0xf2, 0x29, 0xc5, 0xff, 0xcb, 0x1a, 0xbe, 0x86, 0x6c, 0xe0, 0xa3, 0x54, 0xb6, 0xca, 0xbd, 0xa3,
	0x88, 0x90, 0xc2, 0x73, 0x2b, 0x4f, 0x43, 0xcf, 0x6d, 0xb8, 0xdd, 0x85, 0xff, 0xd9, 0x4f, 0xb8,
	0xab, 0x7b, 0xc8, 0xbe, 0x1d, 0x6e, 0xb4, 0xb1, 0xf8, 0x0e, 0xe0, 0x86, 0x2b, 0xd1, 0x4b, 0xff,
	0xb6, 0xca, 0xe8, 0xdf, 0x81, 0x2d, 0x4c, 0xb7, 0xb0, 0x3d, 0xd2, 0x67, 0xb8, 0x87, 0xcb, 0x83,
	0x54, 0x62, 0xf9, 0x88, 0x70, 0x4a, 0x6b, 0xe6, 0x9e, 0x36, 0x7d, 0xcf, 0xfc, 0x0b, 0xde, 0xff,
	0x0b, 0x00, 0x00, 0xff, 0xff, 0x8a, 0xd2, 0x83, 0x16, 0xcd, 0x03, 0x00, 0x00,
}
