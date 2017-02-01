// Code generated by protoc-gen-go.
// source: sim.proto
// DO NOT EDIT!

/*
Package simRPC is a generated protocol buffer package.

It is generated from these files:
	sim.proto

It has these top-level messages:
	Ping
	Ack
	ListSimInfosParams
	SimInfo
	SimInfoList
	ClientMembership
	BodyUpdate
	AvatarMotion
	Setting
	NodeUpdate
	UpdateRequest
	AddNodeRequest
	RemoveNodeRequest
*/
package simRPC

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

type ListSimInfosParams struct {
}

func (m *ListSimInfosParams) Reset()                    { *m = ListSimInfosParams{} }
func (m *ListSimInfosParams) String() string            { return proto.CompactTextString(m) }
func (*ListSimInfosParams) ProtoMessage()               {}
func (*ListSimInfosParams) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{2} }

type SimInfo struct {
	Name string `protobuf:"bytes,1,opt,name=name" json:"name,omitempty"`
	Uuid string `protobuf:"bytes,2,opt,name=uuid" json:"uuid,omitempty"`
}

func (m *SimInfo) Reset()                    { *m = SimInfo{} }
func (m *SimInfo) String() string            { return proto.CompactTextString(m) }
func (*SimInfo) ProtoMessage()               {}
func (*SimInfo) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{3} }

func (m *SimInfo) GetName() string {
	if m != nil {
		return m.Name
	}
	return ""
}

func (m *SimInfo) GetUuid() string {
	if m != nil {
		return m.Uuid
	}
	return ""
}

type SimInfoList struct {
	Infos []*SimInfo `protobuf:"bytes,1,rep,name=infos" json:"infos,omitempty"`
}

func (m *SimInfoList) Reset()                    { *m = SimInfoList{} }
func (m *SimInfoList) String() string            { return proto.CompactTextString(m) }
func (*SimInfoList) ProtoMessage()               {}
func (*SimInfoList) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{4} }

func (m *SimInfoList) GetInfos() []*SimInfo {
	if m != nil {
		return m.Infos
	}
	return nil
}

type ClientMembership struct {
	ClientUUID string `protobuf:"bytes,1,opt,name=clientUUID" json:"clientUUID,omitempty"`
	SpaceUUID  string `protobuf:"bytes,2,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	Member     bool   `protobuf:"varint,3,opt,name=member" json:"member,omitempty"`
	Avatar     bool   `protobuf:"varint,4,opt,name=avatar" json:"avatar,omitempty"`
}

func (m *ClientMembership) Reset()                    { *m = ClientMembership{} }
func (m *ClientMembership) String() string            { return proto.CompactTextString(m) }
func (*ClientMembership) ProtoMessage()               {}
func (*ClientMembership) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{5} }

func (m *ClientMembership) GetClientUUID() string {
	if m != nil {
		return m.ClientUUID
	}
	return ""
}

func (m *ClientMembership) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *ClientMembership) GetMember() bool {
	if m != nil {
		return m.Member
	}
	return false
}

func (m *ClientMembership) GetAvatar() bool {
	if m != nil {
		return m.Avatar
	}
	return false
}

type BodyUpdate struct {
	Name        string    `protobuf:"bytes,1,opt,name=name" json:"name,omitempty"`
	Position    []float64 `protobuf:"fixed64,2,rep,packed,name=position" json:"position,omitempty"`
	Orientation []float64 `protobuf:"fixed64,3,rep,packed,name=orientation" json:"orientation,omitempty"`
	Translation []float64 `protobuf:"fixed64,4,rep,packed,name=translation" json:"translation,omitempty"`
	Rotation    []float64 `protobuf:"fixed64,5,rep,packed,name=rotation" json:"rotation,omitempty"`
}

func (m *BodyUpdate) Reset()                    { *m = BodyUpdate{} }
func (m *BodyUpdate) String() string            { return proto.CompactTextString(m) }
func (*BodyUpdate) ProtoMessage()               {}
func (*BodyUpdate) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{6} }

func (m *BodyUpdate) GetName() string {
	if m != nil {
		return m.Name
	}
	return ""
}

func (m *BodyUpdate) GetPosition() []float64 {
	if m != nil {
		return m.Position
	}
	return nil
}

func (m *BodyUpdate) GetOrientation() []float64 {
	if m != nil {
		return m.Orientation
	}
	return nil
}

func (m *BodyUpdate) GetTranslation() []float64 {
	if m != nil {
		return m.Translation
	}
	return nil
}

func (m *BodyUpdate) GetRotation() []float64 {
	if m != nil {
		return m.Rotation
	}
	return nil
}

type AvatarMotion struct {
	SpaceUUID   string        `protobuf:"bytes,1,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	ClientUUID  string        `protobuf:"bytes,2,opt,name=clientUUID" json:"clientUUID,omitempty"`
	Position    []float64     `protobuf:"fixed64,3,rep,packed,name=position" json:"position,omitempty"`
	Orientation []float64     `protobuf:"fixed64,4,rep,packed,name=orientation" json:"orientation,omitempty"`
	Translation []float64     `protobuf:"fixed64,5,rep,packed,name=translation" json:"translation,omitempty"`
	Rotation    []float64     `protobuf:"fixed64,6,rep,packed,name=rotation" json:"rotation,omitempty"`
	Scale       []float64     `protobuf:"fixed64,7,rep,packed,name=scale" json:"scale,omitempty"`
	BodyUpdates []*BodyUpdate `protobuf:"bytes,8,rep,name=bodyUpdates" json:"bodyUpdates,omitempty"`
}

func (m *AvatarMotion) Reset()                    { *m = AvatarMotion{} }
func (m *AvatarMotion) String() string            { return proto.CompactTextString(m) }
func (*AvatarMotion) ProtoMessage()               {}
func (*AvatarMotion) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{7} }

func (m *AvatarMotion) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *AvatarMotion) GetClientUUID() string {
	if m != nil {
		return m.ClientUUID
	}
	return ""
}

func (m *AvatarMotion) GetPosition() []float64 {
	if m != nil {
		return m.Position
	}
	return nil
}

func (m *AvatarMotion) GetOrientation() []float64 {
	if m != nil {
		return m.Orientation
	}
	return nil
}

func (m *AvatarMotion) GetTranslation() []float64 {
	if m != nil {
		return m.Translation
	}
	return nil
}

func (m *AvatarMotion) GetRotation() []float64 {
	if m != nil {
		return m.Rotation
	}
	return nil
}

func (m *AvatarMotion) GetScale() []float64 {
	if m != nil {
		return m.Scale
	}
	return nil
}

func (m *AvatarMotion) GetBodyUpdates() []*BodyUpdate {
	if m != nil {
		return m.BodyUpdates
	}
	return nil
}

type Setting struct {
	Name  string `protobuf:"bytes,1,opt,name=name" json:"name,omitempty"`
	Value string `protobuf:"bytes,2,opt,name=value" json:"value,omitempty"`
}

func (m *Setting) Reset()                    { *m = Setting{} }
func (m *Setting) String() string            { return proto.CompactTextString(m) }
func (*Setting) ProtoMessage()               {}
func (*Setting) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{8} }

func (m *Setting) GetName() string {
	if m != nil {
		return m.Name
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
	Id           int64      `protobuf:"varint,1,opt,name=Id" json:"Id,omitempty"`
	Settings     []*Setting `protobuf:"bytes,2,rep,name=settings" json:"settings,omitempty"`
	Position     []float64  `protobuf:"fixed64,3,rep,packed,name=position" json:"position,omitempty"`
	Orientation  []float64  `protobuf:"fixed64,4,rep,packed,name=orientation" json:"orientation,omitempty"`
	Translation  []float64  `protobuf:"fixed64,5,rep,packed,name=translation" json:"translation,omitempty"`
	Rotation     []float64  `protobuf:"fixed64,6,rep,packed,name=rotation" json:"rotation,omitempty"`
	Scale        []float64  `protobuf:"fixed64,7,rep,packed,name=scale" json:"scale,omitempty"`
	TemplateUUID string     `protobuf:"bytes,8,opt,name=templateUUID" json:"templateUUID,omitempty"`
}

func (m *NodeUpdate) Reset()                    { *m = NodeUpdate{} }
func (m *NodeUpdate) String() string            { return proto.CompactTextString(m) }
func (*NodeUpdate) ProtoMessage()               {}
func (*NodeUpdate) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{9} }

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

func (m *NodeUpdate) GetTemplateUUID() string {
	if m != nil {
		return m.TemplateUUID
	}
	return ""
}

type UpdateRequest struct {
	SpaceUUID   string        `protobuf:"bytes,1,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	ClientUUID  string        `protobuf:"bytes,2,opt,name=clientUUID" json:"clientUUID,omitempty"`
	NodeUpdates []*NodeUpdate `protobuf:"bytes,3,rep,name=nodeUpdates" json:"nodeUpdates,omitempty"`
}

func (m *UpdateRequest) Reset()                    { *m = UpdateRequest{} }
func (m *UpdateRequest) String() string            { return proto.CompactTextString(m) }
func (*UpdateRequest) ProtoMessage()               {}
func (*UpdateRequest) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{10} }

func (m *UpdateRequest) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *UpdateRequest) GetClientUUID() string {
	if m != nil {
		return m.ClientUUID
	}
	return ""
}

func (m *UpdateRequest) GetNodeUpdates() []*NodeUpdate {
	if m != nil {
		return m.NodeUpdates
	}
	return nil
}

type AddNodeRequest struct {
	SpaceUUID    string    `protobuf:"bytes,1,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	ClientUUID   string    `protobuf:"bytes,2,opt,name=clientUUID" json:"clientUUID,omitempty"`
	TemplateUUID string    `protobuf:"bytes,3,opt,name=templateUUID" json:"templateUUID,omitempty"`
	Parent       int64     `protobuf:"varint,4,opt,name=parent" json:"parent,omitempty"`
	Position     []float64 `protobuf:"fixed64,5,rep,packed,name=position" json:"position,omitempty"`
	Orientation  []float64 `protobuf:"fixed64,6,rep,packed,name=orientation" json:"orientation,omitempty"`
}

func (m *AddNodeRequest) Reset()                    { *m = AddNodeRequest{} }
func (m *AddNodeRequest) String() string            { return proto.CompactTextString(m) }
func (*AddNodeRequest) ProtoMessage()               {}
func (*AddNodeRequest) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{11} }

func (m *AddNodeRequest) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *AddNodeRequest) GetClientUUID() string {
	if m != nil {
		return m.ClientUUID
	}
	return ""
}

func (m *AddNodeRequest) GetTemplateUUID() string {
	if m != nil {
		return m.TemplateUUID
	}
	return ""
}

func (m *AddNodeRequest) GetParent() int64 {
	if m != nil {
		return m.Parent
	}
	return 0
}

func (m *AddNodeRequest) GetPosition() []float64 {
	if m != nil {
		return m.Position
	}
	return nil
}

func (m *AddNodeRequest) GetOrientation() []float64 {
	if m != nil {
		return m.Orientation
	}
	return nil
}

type RemoveNodeRequest struct {
	SpaceUUID  string `protobuf:"bytes,1,opt,name=spaceUUID" json:"spaceUUID,omitempty"`
	ClientUUID string `protobuf:"bytes,2,opt,name=clientUUID" json:"clientUUID,omitempty"`
	Id         int64  `protobuf:"varint,3,opt,name=id" json:"id,omitempty"`
}

func (m *RemoveNodeRequest) Reset()                    { *m = RemoveNodeRequest{} }
func (m *RemoveNodeRequest) String() string            { return proto.CompactTextString(m) }
func (*RemoveNodeRequest) ProtoMessage()               {}
func (*RemoveNodeRequest) Descriptor() ([]byte, []int) { return fileDescriptor0, []int{12} }

func (m *RemoveNodeRequest) GetSpaceUUID() string {
	if m != nil {
		return m.SpaceUUID
	}
	return ""
}

func (m *RemoveNodeRequest) GetClientUUID() string {
	if m != nil {
		return m.ClientUUID
	}
	return ""
}

func (m *RemoveNodeRequest) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

func init() {
	proto.RegisterType((*Ping)(nil), "simRPC.Ping")
	proto.RegisterType((*Ack)(nil), "simRPC.Ack")
	proto.RegisterType((*ListSimInfosParams)(nil), "simRPC.ListSimInfosParams")
	proto.RegisterType((*SimInfo)(nil), "simRPC.SimInfo")
	proto.RegisterType((*SimInfoList)(nil), "simRPC.SimInfoList")
	proto.RegisterType((*ClientMembership)(nil), "simRPC.ClientMembership")
	proto.RegisterType((*BodyUpdate)(nil), "simRPC.BodyUpdate")
	proto.RegisterType((*AvatarMotion)(nil), "simRPC.AvatarMotion")
	proto.RegisterType((*Setting)(nil), "simRPC.Setting")
	proto.RegisterType((*NodeUpdate)(nil), "simRPC.NodeUpdate")
	proto.RegisterType((*UpdateRequest)(nil), "simRPC.UpdateRequest")
	proto.RegisterType((*AddNodeRequest)(nil), "simRPC.AddNodeRequest")
	proto.RegisterType((*RemoveNodeRequest)(nil), "simRPC.RemoveNodeRequest")
}

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConn

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion4

// Client API for SimHost service

type SimHostClient interface {
	// Test whether a sim host is responsive
	HandlePing(ctx context.Context, in *Ping, opts ...grpc.CallOption) (*Ack, error)
	// Get info about the simulations from the sim host
	ListSimInfos(ctx context.Context, in *ListSimInfosParams, opts ...grpc.CallOption) (*SimInfoList, error)
	// Tell a sim when a client enters and leaves a space
	HandleClientMembership(ctx context.Context, in *ClientMembership, opts ...grpc.CallOption) (*Ack, error)
	// Tell a sim when a user initiates avatar motion
	HandleAvatarMotion(ctx context.Context, in *AvatarMotion, opts ...grpc.CallOption) (*Ack, error)
	// Tell a sim when a client requests a setting update
	HandleUpdateRequest(ctx context.Context, in *UpdateRequest, opts ...grpc.CallOption) (*Ack, error)
	// Tell a sim when a client requests a new node
	HandleAddNodeRequest(ctx context.Context, in *AddNodeRequest, opts ...grpc.CallOption) (*Ack, error)
	// Tell a sim when a client requests node be removed
	HandleRemoveNodeRequest(ctx context.Context, in *RemoveNodeRequest, opts ...grpc.CallOption) (*Ack, error)
}

type simHostClient struct {
	cc *grpc.ClientConn
}

func NewSimHostClient(cc *grpc.ClientConn) SimHostClient {
	return &simHostClient{cc}
}

func (c *simHostClient) HandlePing(ctx context.Context, in *Ping, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandlePing", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) ListSimInfos(ctx context.Context, in *ListSimInfosParams, opts ...grpc.CallOption) (*SimInfoList, error) {
	out := new(SimInfoList)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/ListSimInfos", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) HandleClientMembership(ctx context.Context, in *ClientMembership, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandleClientMembership", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) HandleAvatarMotion(ctx context.Context, in *AvatarMotion, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandleAvatarMotion", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) HandleUpdateRequest(ctx context.Context, in *UpdateRequest, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandleUpdateRequest", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) HandleAddNodeRequest(ctx context.Context, in *AddNodeRequest, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandleAddNodeRequest", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *simHostClient) HandleRemoveNodeRequest(ctx context.Context, in *RemoveNodeRequest, opts ...grpc.CallOption) (*Ack, error) {
	out := new(Ack)
	err := grpc.Invoke(ctx, "/simRPC.SimHost/HandleRemoveNodeRequest", in, out, c.cc, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Server API for SimHost service

type SimHostServer interface {
	// Test whether a sim host is responsive
	HandlePing(context.Context, *Ping) (*Ack, error)
	// Get info about the simulations from the sim host
	ListSimInfos(context.Context, *ListSimInfosParams) (*SimInfoList, error)
	// Tell a sim when a client enters and leaves a space
	HandleClientMembership(context.Context, *ClientMembership) (*Ack, error)
	// Tell a sim when a user initiates avatar motion
	HandleAvatarMotion(context.Context, *AvatarMotion) (*Ack, error)
	// Tell a sim when a client requests a setting update
	HandleUpdateRequest(context.Context, *UpdateRequest) (*Ack, error)
	// Tell a sim when a client requests a new node
	HandleAddNodeRequest(context.Context, *AddNodeRequest) (*Ack, error)
	// Tell a sim when a client requests node be removed
	HandleRemoveNodeRequest(context.Context, *RemoveNodeRequest) (*Ack, error)
}

func RegisterSimHostServer(s *grpc.Server, srv SimHostServer) {
	s.RegisterService(&_SimHost_serviceDesc, srv)
}

func _SimHost_HandlePing_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(Ping)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandlePing(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandlePing",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandlePing(ctx, req.(*Ping))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_ListSimInfos_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListSimInfosParams)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).ListSimInfos(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/ListSimInfos",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).ListSimInfos(ctx, req.(*ListSimInfosParams))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_HandleClientMembership_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ClientMembership)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandleClientMembership(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandleClientMembership",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandleClientMembership(ctx, req.(*ClientMembership))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_HandleAvatarMotion_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(AvatarMotion)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandleAvatarMotion(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandleAvatarMotion",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandleAvatarMotion(ctx, req.(*AvatarMotion))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_HandleUpdateRequest_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UpdateRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandleUpdateRequest(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandleUpdateRequest",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandleUpdateRequest(ctx, req.(*UpdateRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_HandleAddNodeRequest_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(AddNodeRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandleAddNodeRequest(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandleAddNodeRequest",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandleAddNodeRequest(ctx, req.(*AddNodeRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SimHost_HandleRemoveNodeRequest_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(RemoveNodeRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SimHostServer).HandleRemoveNodeRequest(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/simRPC.SimHost/HandleRemoveNodeRequest",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SimHostServer).HandleRemoveNodeRequest(ctx, req.(*RemoveNodeRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _SimHost_serviceDesc = grpc.ServiceDesc{
	ServiceName: "simRPC.SimHost",
	HandlerType: (*SimHostServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "HandlePing",
			Handler:    _SimHost_HandlePing_Handler,
		},
		{
			MethodName: "ListSimInfos",
			Handler:    _SimHost_ListSimInfos_Handler,
		},
		{
			MethodName: "HandleClientMembership",
			Handler:    _SimHost_HandleClientMembership_Handler,
		},
		{
			MethodName: "HandleAvatarMotion",
			Handler:    _SimHost_HandleAvatarMotion_Handler,
		},
		{
			MethodName: "HandleUpdateRequest",
			Handler:    _SimHost_HandleUpdateRequest_Handler,
		},
		{
			MethodName: "HandleAddNodeRequest",
			Handler:    _SimHost_HandleAddNodeRequest_Handler,
		},
		{
			MethodName: "HandleRemoveNodeRequest",
			Handler:    _SimHost_HandleRemoveNodeRequest_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "sim.proto",
}

func init() { proto.RegisterFile("sim.proto", fileDescriptor0) }

var fileDescriptor0 = []byte{
	// 659 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x09, 0x6e, 0x88, 0x02, 0xff, 0xcc, 0x55, 0xcd, 0x6e, 0xd3, 0x40,
	0x10, 0xc6, 0x76, 0xfe, 0x3a, 0x0e, 0x05, 0xb6, 0xa1, 0x98, 0x08, 0x41, 0xb4, 0x12, 0x52, 0x10,
	0x52, 0x25, 0xda, 0x5e, 0x10, 0xe2, 0x10, 0xca, 0xa1, 0x91, 0x28, 0xaa, 0xb6, 0xea, 0x03, 0x6c,
	0xe3, 0xa5, 0xac, 0x6a, 0x7b, 0x8d, 0x77, 0x13, 0x89, 0x1b, 0x12, 0xaf, 0xc0, 0x91, 0xe7, 0xe0,
	0x19, 0x78, 0x2b, 0xd0, 0xee, 0xda, 0x8e, 0x7f, 0x4a, 0x38, 0xd0, 0x03, 0xb7, 0xcc, 0x37, 0xdf,
	0xcc, 0xce, 0x37, 0x33, 0x9e, 0xc0, 0x96, 0xe4, 0xf1, 0x5e, 0x9a, 0x09, 0x25, 0x50, 0x4f, 0xf2,
	0x98, 0x9c, 0x1e, 0xe1, 0x31, 0x74, 0x4e, 0x79, 0x72, 0x89, 0x10, 0x74, 0x12, 0x1a, 0xb3, 0xc0,
	0x99, 0x38, 0xd3, 0x2d, 0x62, 0x7e, 0xe3, 0x27, 0xe0, 0xcd, 0x16, 0x57, 0x28, 0x80, 0x7e, 0xcc,
	0xa4, 0xa4, 0x97, 0x85, 0xb7, 0x30, 0xf1, 0x08, 0xd0, 0x3b, 0x2e, 0xd5, 0x19, 0x8f, 0xe7, 0xc9,
	0x07, 0x21, 0x4f, 0x69, 0x46, 0x63, 0x89, 0x5f, 0x40, 0x3f, 0x47, 0xae, 0xcb, 0xaa, 0xb1, 0xe5,
	0x92, 0x87, 0x81, 0x6b, 0x31, 0xfd, 0x1b, 0x1f, 0x82, 0x9f, 0x87, 0xe8, 0x7c, 0xe8, 0x29, 0x74,
	0xb9, 0x4e, 0x18, 0x38, 0x13, 0x6f, 0xea, 0xef, 0xdf, 0xd9, 0xb3, 0xc5, 0xee, 0xe5, 0x1c, 0x62,
	0xbd, 0xf8, 0x8b, 0x03, 0x77, 0x8f, 0x22, 0xce, 0x12, 0x75, 0xc2, 0xe2, 0x0b, 0x96, 0xc9, 0x8f,
	0x3c, 0x45, 0x8f, 0x01, 0x16, 0x06, 0x3b, 0x3f, 0x9f, 0xbf, 0xcd, 0x1f, 0xae, 0x20, 0xe8, 0x11,
	0x6c, 0xc9, 0x94, 0x2e, 0x98, 0x71, 0xdb, 0x1a, 0xd6, 0x00, 0xda, 0x85, 0x5e, 0x6c, 0x72, 0x05,
	0xde, 0xc4, 0x99, 0x0e, 0x48, 0x6e, 0x69, 0x9c, 0xae, 0xa8, 0xa2, 0x59, 0xd0, 0xb1, 0xb8, 0xb5,
	0xf0, 0x77, 0x07, 0xe0, 0x8d, 0x08, 0x3f, 0x9f, 0xa7, 0x21, 0x55, 0xec, 0x5a, 0xbd, 0x63, 0x18,
	0xa4, 0x42, 0x72, 0xc5, 0x45, 0x12, 0xb8, 0x13, 0x6f, 0xea, 0x90, 0xd2, 0x46, 0x13, 0xf0, 0x45,
	0xa6, 0x4b, 0xa3, 0xc6, 0xed, 0x19, 0x77, 0x15, 0xd2, 0x0c, 0x95, 0xd1, 0x44, 0x46, 0x96, 0xd1,
	0xb1, 0x8c, 0x0a, 0xa4, 0xf3, 0x67, 0x22, 0x4f, 0xd0, 0xb5, 0xf9, 0x0b, 0x1b, 0x7f, 0x73, 0x61,
	0x38, 0x33, 0x95, 0x9e, 0x08, 0x43, 0xae, 0xa9, 0x77, 0x9a, 0xea, 0xeb, 0xbd, 0x73, 0x5b, 0xbd,
	0xab, 0x4a, 0xf1, 0x36, 0x4b, 0xe9, 0xfc, 0x55, 0x4a, 0x77, 0xb3, 0x94, 0x5e, 0x5d, 0x0a, 0x1a,
	0x41, 0x57, 0x2e, 0x68, 0xc4, 0x82, 0xbe, 0x71, 0x58, 0x03, 0x1d, 0x82, 0x7f, 0x51, 0xb6, 0x5f,
	0x06, 0x03, 0xb3, 0x2f, 0xa8, 0xd8, 0x97, 0xf5, 0x64, 0x48, 0x95, 0x86, 0x0f, 0xa0, 0x7f, 0xc6,
	0x94, 0xfa, 0xc3, 0xde, 0xeb, 0xa7, 0x56, 0x34, 0x5a, 0xb2, 0xbc, 0x03, 0xd6, 0xc0, 0xbf, 0x1c,
	0x80, 0xf7, 0x22, 0x64, 0xf9, 0xa8, 0xb7, 0xc1, 0x9d, 0x87, 0x26, 0xcc, 0x23, 0xee, 0x3c, 0x44,
	0xcf, 0x61, 0x20, 0x6d, 0x4e, 0x69, 0xc6, 0x5c, 0x5d, 0x5b, 0x8b, 0x93, 0x92, 0xf0, 0x1f, 0x36,
	0x12, 0xc3, 0x50, 0xb1, 0x38, 0x8d, 0xa8, 0xb2, 0xbb, 0x31, 0x30, 0xd2, 0x6b, 0x18, 0xfe, 0xea,
	0xc0, 0xed, 0xbc, 0x9d, 0xec, 0xd3, 0x92, 0x49, 0xf5, 0x8f, 0xeb, 0x74, 0x08, 0x7e, 0x52, 0x36,
	0x54, 0x9a, 0x46, 0x54, 0x86, 0xb7, 0xee, 0x35, 0xa9, 0xd2, 0xf0, 0x4f, 0x07, 0xb6, 0x67, 0x61,
	0xa8, 0xdd, 0x37, 0x53, 0x46, 0x53, 0xba, 0xd7, 0x96, 0xae, 0xbf, 0xff, 0x94, 0x66, 0x2c, 0x51,
	0xe6, 0xfb, 0xf7, 0x48, 0x6e, 0xd5, 0x06, 0xd9, 0xdd, 0x3c, 0xc8, 0x5e, 0x6b, 0x90, 0x98, 0xc2,
	0x3d, 0xc2, 0x62, 0xb1, 0x62, 0x37, 0x27, 0x66, 0x1b, 0x5c, 0x1e, 0x1a, 0x09, 0x1e, 0x71, 0x79,
	0xb8, 0xff, 0xc3, 0x33, 0xd7, 0xf8, 0x58, 0x48, 0x85, 0x9e, 0x01, 0x1c, 0xd3, 0x24, 0x8c, 0x98,
	0xb9, 0xf8, 0xc3, 0xa2, 0xd1, 0xda, 0x1a, 0xfb, 0x85, 0x35, 0x5b, 0x5c, 0xe1, 0x5b, 0x68, 0x06,
	0xc3, 0xea, 0x65, 0x47, 0xe3, 0xc2, 0xdd, 0xbe, 0xf7, 0xe3, 0x9d, 0xc6, 0x79, 0xd6, 0x14, 0x93,
	0x62, 0xd7, 0xbe, 0xd6, 0x3a, 0xd1, 0x41, 0x11, 0xd0, 0xf4, 0x34, 0xab, 0x78, 0x09, 0xc8, 0xa6,
	0xa8, 0xdd, 0xb0, 0x51, 0x49, 0xaa, 0xa0, 0xcd, 0xd0, 0x57, 0xb0, 0x63, 0x43, 0xeb, 0x0b, 0x7b,
	0xbf, 0x60, 0xd5, 0xe0, 0x66, 0xf0, 0x6b, 0x18, 0xe5, 0xef, 0xd6, 0xf7, 0x6c, 0xb7, 0xa4, 0xd5,
	0xf0, 0x66, 0xf8, 0x11, 0x3c, 0xb0, 0xe1, 0xed, 0xe1, 0x3e, 0x2c, 0x98, 0x2d, 0x57, 0x23, 0xc9,
	0x45, 0xcf, 0xfc, 0x4f, 0x1f, 0xfc, 0x0e, 0x00, 0x00, 0xff, 0xff, 0x3d, 0x23, 0x06, 0xd9, 0xb4,
	0x07, 0x00, 0x00,
}
