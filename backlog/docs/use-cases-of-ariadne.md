# Use cases

## Dynamic code extraction from a repository

## Setup

An open source repository contains lots of useful sub-modules that are deeply nested but inaccessible to be used standalone. We want to extract that particular module and make it separately installable.

## Idea

We can use Ariadne to track and analyse that particular module / call-graph of that module. Then use an agent to shadow the original repository, keeping the module up to date with the original repository.

The hypothesis is that Ariadne can detect a change in that particular module just by running some code i.e. without any LLM calls, making it extremely cheap and therefore easy to run on a regular basis.
