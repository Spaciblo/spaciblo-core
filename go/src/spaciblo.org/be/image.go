package be

import (
	"bytes"
	"errors"
	"fmt"
	"github.com/nfnt/resize"
	"image"
	"image/draw"
	"math"

	_ "image/gif"
	"image/jpeg"
	_ "image/png"
)

/*
FitCrop gets from or creates in fileStorage a fit-cropped derivative of the File with Key key
*/
func FitCrop(maxWidth int, maxHeight int, key string, fileStorage FileStorage) (File, error) {
	if maxWidth <= 0 || maxHeight <= 0 {
		return nil, errors.New(fmt.Sprintf("Bogus maxWidth or maxHeight: %dx%d", maxWidth, maxHeight))
	}
	// A little sanity checking. (I look forward to when this is not big enough for the web.)
	if maxWidth > 4000 || maxHeight > 4000 {
		return nil, errors.New(fmt.Sprintf("Image too large: %dx%d", maxWidth, maxHeight))
	}

	derivative := fmt.Sprintf("fit-crop-%dx%d", maxWidth, maxHeight)

	// Return any existing derivative
	dFile, err := fileStorage.Get(key, derivative)
	if err == nil {
		return dFile, nil
	}
	origFile, err := fileStorage.Get(key, "")
	if err != nil {
		return nil, err
	}
	reader, err := origFile.Reader()
	if err != nil {
		return nil, err
	}
	origImage, _, err := image.Decode(reader)
	if err != nil {
		return nil, err
	}
	origBounds := origImage.Bounds()
	targetWidth := float64(origBounds.Dx())
	targetHeight := float64(origBounds.Dy())
	maxWidthF := float64(maxWidth)
	maxHeightF := float64(maxHeight)
	scale := math.Max(maxWidthF/targetWidth, maxHeightF/targetHeight)

	// Get it in the right size
	targetWidth = targetWidth * scale
	targetHeight = targetHeight * scale
	targetImage := resize.Resize(uint(targetWidth), uint(targetHeight), origImage, resize.Lanczos3) // The slowest algorithm but with the nicest output
	maxWidthF = math.Min(maxWidthF, targetWidth)
	maxHeightF = math.Min(maxHeightF, targetHeight)

	// Then crop it
	left := int((targetWidth - maxWidthF) / 2)
	top := int((targetHeight - maxHeightF) / 2)
	right := left + int(maxWidthF)
	bottom := top + int(maxHeightF)
	cropRect := image.Rect(left, top, right, bottom)
	croppedImage := image.NewRGBA(image.Rect(0, 0, cropRect.Dx(), cropRect.Dy()))
	draw.Draw(croppedImage, croppedImage.Bounds(), targetImage, cropRect.Min, draw.Src)

	buffer := bytes.NewBuffer(make([]byte, 0))
	err = jpeg.Encode(buffer, croppedImage, &jpeg.Options{jpeg.DefaultQuality})
	if err != nil {
		return nil, err
	}
	err = fileStorage.PutDerivative(key, derivative, buffer)
	if err != nil {
		return nil, err
	}
	dFile, err = fileStorage.Get(key, derivative)
	if err != nil {
		return nil, err
	}
	return dFile, nil
}
